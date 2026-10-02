// Membuktikan aplikasi kasir berjalan benar di basis data yang dipakai
// bersama aplikasi Boomboo lain, dan tidak bisa menyentuh data mereka.
//
// Data uji yang dibuat di sini dibersihkan lagi di bagian akhir.
// Pakai: node uji/pindah-basis-data.mjs
import 'dotenv/config';
import pool, { kueri, SKEMA } from '../src/shared/db/pool.js';

const API = process.env.API_URL || 'http://localhost:4100/api';
let token;

const panggil = async (jalur, opsi = {}) => {
  const r = await fetch(API + jalur, {
    ...opsi,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opsi.headers,
    },
  });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
const kirim = (jalur, body, metode = 'POST') =>
  panggil(jalur, { method: metode, body: JSON.stringify(body) });

let lulus = 0;
let gagal = 0;
const cek = (nama, ok, catatan = '') => {
  ok ? lulus++ : gagal++;
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${nama}${catatan ? '  -> ' + catatan : ''}`);
};
const bagian = (j) => console.log(`\n${j}`);

console.log('\nUJI PINDAH BASIS DATA\n' + '='.repeat(66));

/* ================================================================== */
bagian('1. SEKAT ANTAR APLIKASI');

const { rows: info } = await kueri(
  "select current_database() db, current_setting('search_path') sp"
);
cek('Tersambung ke basis data milik user', info[0].db === 'postgres', info[0].db);
cek('Jalur pencarian dikunci ke skema aplikasi kasir', info[0].sp.startsWith(SKEMA), info[0].sp);
cek('Skema public TIDAK ikut dalam jalur pencarian', !info[0].sp.includes('public'));

for (const tabel of ['ingredients', 'purchase_orders', 'products', 'profiles']) {
  let terlihat = true;
  try {
    await kueri(`select 1 from ${tabel} limit 1`);
  } catch {
    terlihat = false;
  }
  cek(`Tabel "${tabel}" milik aplikasi lain tidak terlihat`, !terlihat);
}

const { rows: tabelKita } = await kueri(
  "select count(*)::int n from information_schema.tables where table_schema = $1 and table_type = 'BASE TABLE'",
  [SKEMA]
);
cek('Tabel aplikasi kasir lengkap di skemanya sendiri', tabelKita[0].n === 17, `${tabelKita[0].n} tabel`);

const { rows: punyaMereka } = await kueri(
  "select count(*)::int n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
);
cek('Tabel aplikasi lain tetap utuh', punyaMereka[0].n === 49, `${punyaMereka[0].n} tabel di public`);

/* ================================================================== */
bagian('2. AKUN PENGGUNA');

const masuk = await kirim('/auth/masuk', {
  email: 'lutfi@boomboo.id',
  password: process.env.SANDI_UJI,
});
token = masuk.data?.token;
cek('Bisa masuk dengan kata sandi baru', Boolean(token), masuk.data?.user?.nama);
if (!token) {
  console.log('\nTidak bisa lanjut tanpa token.\n');
  await pool.end();
  process.exit(1);
}

const { rows: user } = await kueri('select count(*)::int n from users');
cek('Enam akun ikut pindah', user[0].n === 6, `${user[0].n} akun`);
cek('Kata sandi lama sudah tidak berlaku',
  (await kirim('/auth/masuk', { email: 'lutfi@boomboo.id', password: 'boomboo123' })).status === 401);

/* ================================================================== */
bagian('3. PRODUK DARI BERKAS PRICE LIST');

const produk = (await panggil('/produk')).data || [];
cek('Sebelas produk masuk', produk.length === 11, `${produk.length} produk`);
cek('Harganya sesuai berkas',
  produk.find((p) => p.nama === 'Sambal Daun Jeruk Sachet Level 4')?.harga === 69000);
cek('Stok semuanya masih nol', produk.every((p) => p.stok === 0), produk.map((p) => p.stok).join(','));
cek('Semuanya dijual satuan', produk.every((p) => p.dijual_satuan === true));
cek('Menu masih kosong', ((await panggil('/menu')).data || []).length === 0);

/* ================================================================== */
bagian('4. ALUR JUALAN SUNGGUHAN DI BASIS DATA BARU');

const uji = produk.find((p) => p.nama === 'Sambal Daun Jeruk Level 2');
const stok = async () => (await panggil(`/produk/${uji.id}`)).data.stok;

// Diukur sebagai selisih, bukan angka mutlak, supaya hasilnya tetap benar
// walaupun ada sisa data atau ada kasir lain yang sedang memakai aplikasi.
const awal = await stok();
const tambahStok = await kirim(`/stok/${uji.id}/tambah`, { jumlah: 10, catatan: 'Uji pindah basis data' });
cek('Stok bisa ditambah', tambahStok.status === 200, tambahStok.pesan);
cek('Penambahannya tepat 10', (await stok()) - awal === 10);

const sebelumJual = await stok();
const trx = await kirim('/transaksi', {
  item: [{ jenis_barang: 'produk', barang_id: uji.id, jumlah: 2 }],
});
cek('Transaksi bisa dibuat', trx.status === 201, trx.data?.nomor);
cek('Stok belum berkurang sebelum dibayar', (await stok()) === sebelumJual);

const bayar = await kirim(`/transaksi/${trx.data.id}/konfirmasi`, {});
cek('Pembayaran bisa dikonfirmasi', bayar.status === 200);
cek('Stok berkurang 2 setelah dibayar', sebelumJual - (await stok()) === 2);

const bill = await kirim('/bill', { nama_pembeli: 'Uji Pindah', nomor_wa: '081200000000' });
cek('Open Bill bisa dibuka', bill.status === 201, bill.data?.nomor);
const sebelumBill = await stok();
await kirim(`/bill/${bill.data.id}/item`, {
  jenis_barang: 'produk',
  barang_id: uji.id,
  jumlah: 3,
});
cek('Stok langsung berkurang 3 saat masuk bill', sebelumBill - (await stok()) === 3);

const sesudahBill = await stok();
const tutup = await kirim(`/bill/${bill.data.id}/tutup`, {});
await kirim(`/transaksi/${tutup.data.id}/konfirmasi`, {});
cek('Stok tidak dipotong dua kali saat bill dibayar', (await stok()) === sesudahBill);

const { rows: silang } = await kueri(`
  select p.id, p.stok, coalesce(sum(g.jumlah), 0)::int buku
    from produk p left join pergerakan_stok g on g.produk_id = p.id
   group by p.id`);
cek('Buku besar stok cocok dengan angka stok',
  silang.every((r) => r.stok === r.buku), `${silang.length} produk diperiksa`);

const log = (await panggil('/log?per_halaman=50')).data?.daftar || [];
cek('Log aktivitas tercatat di basis data baru', log.length > 0, `${log.length} catatan`);
cek('Semua catatan punya nama pelaku', log.every((l) => Boolean(l.nama_user)));

/* ================================================================== */
bagian('5. DATA UJI DIBERSIHKAN LAGI');

// Tautan silang antara transaksi dan bill dilepas dulu, persis seperti yang
// dilakukan npm run seed:bersihkan.
await kueri('update transaksi set bill_id = null, ditukar_dari_id = null, ditukar_ke_id = null');
await kueri('update bill set transaksi_id = null');
for (const t of [
  'log_aktivitas', 'pergerakan_stok', 'penukaran_item', 'pengembalian_uang',
  'bill_item', 'transaksi_item', 'bill', 'transaksi', 'kontak_whatsapp',
  'urutan_nomor', 'urutan_nomor_bill',
]) {
  await kueri(`delete from ${t}`);
}
await kueri('update produk set stok = 0');

const { rows: sisa } = await kueri(
  'select (select count(*)::int from transaksi) t, (select count(*)::int from bill) b, (select coalesce(sum(stok),0)::int from produk) s, (select count(*)::int from produk) p, (select count(*)::int from users) u'
);
cek('Transaksi uji terhapus', sisa[0].t === 0);
cek('Bill uji terhapus', sisa[0].b === 0);
cek('Stok kembali nol', sisa[0].s === 0);
cek('Sebelas produk tetap ada', sisa[0].p === 11);
cek('Enam akun tetap ada', sisa[0].u === 6);

const { rows: akhir } = await kueri('select count(*)::int n from public.ingredients');
cek('Data aplikasi lain tetap utuh sesudah semuanya', akhir[0].n === 52, `${akhir[0].n} bahan`);

console.log('\n' + '='.repeat(66));
console.log(gagal === 0 ? `  SEMUA ${lulus} UJI LULUS` : `  ${lulus} lulus, ${gagal} GAGAL`);
console.log('='.repeat(66) + '\n');

await pool.end();
process.exit(gagal === 0 ? 0 : 1);
