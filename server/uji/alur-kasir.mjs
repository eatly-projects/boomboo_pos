// Uji alur kasir dari awal sampai akhir, langsung lewat API.
const API = 'http://localhost:4100/api';
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
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
};

const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
let gagal = 0;
const cek = (nama, lulus, catatan = '') => {
  if (!lulus) gagal++;
  console.log(`  ${lulus ? 'LULUS' : 'GAGAL'}  ${nama}${catatan ? '  -> ' + catatan : ''}`);
};

const masuk = await panggil('/auth/masuk', {
  method: 'POST',
  body: JSON.stringify({ email: 'lutfi@boomboo.id', password: 'boomboo123' }),
});
token = masuk.data.token;
console.log('\nUJI ALUR KASIR\n' + '='.repeat(62));
cek('Masuk dengan email dan kata sandi', Boolean(token));

const produk = (await panggil('/produk')).data.find((p) => p.stok > 5);
const menu = (await panggil('/menu')).data[0];
const stokAwal = produk.stok;
console.log(`\n  Produk uji : ${produk.nama} (stok awal ${stokAwal})`);
console.log(`  Menu uji   : ${menu.nama}`);

// 1. Buat transaksi dengan diskon 10 persen
const buat = await panggil('/transaksi', {
  method: 'POST',
  body: JSON.stringify({
    item: [
      { jenis_barang: 'produk', barang_id: produk.id, jumlah: 3 },
      { jenis_barang: 'menu', barang_id: menu.id, jumlah: 2 },
    ],
    diskon_jenis: 'persen',
    diskon_nilai: 10,
  }),
});
const trx = buat.data;
const hargaProduk = produk.harga_diskon ?? produk.harga;
const hargaMenu = menu.harga_diskon ?? menu.harga;
const subtotalHarusnya = hargaProduk * 3 + hargaMenu * 2;

console.log('\n1. MEMBUAT TRANSAKSI');
cek('Transaksi dibuat', buat.status === 201, trx.nomor);
cek('Status menunggu pembayaran', trx.status === 'menunggu_pembayaran');
cek('Subtotal benar', trx.subtotal === subtotalHarusnya, rp(trx.subtotal));
cek('Diskon 10 persen dihitung benar', trx.diskon_rupiah === Math.round(subtotalHarusnya * 0.1), rp(trx.diskon_rupiah));
cek('Total = subtotal dikurangi diskon', trx.total === trx.subtotal - trx.diskon_rupiah, rp(trx.total));

const stokSetelahBuat = (await panggil(`/produk/${produk.id}`)).data.stok;
cek('Stok BELUM berkurang sebelum dibayar', stokSetelahBuat === stokAwal, `${stokAwal} tetap ${stokSetelahBuat}`);

// 2. Konfirmasi tunai
console.log('\n2. KONFIRMASI PEMBAYARAN TUNAI');
const bayar = Math.ceil(trx.total / 50000) * 50000;
const konf = await panggil(`/transaksi/${trx.id}/konfirmasi`, {
  method: 'POST',
  body: JSON.stringify({ metode_bayar: 'tunai', uang_diterima: bayar }),
});
cek('Pembayaran dikonfirmasi', konf.status === 200);
cek('Status jadi selesai', konf.data.status === 'selesai');
cek('Kembalian dihitung benar', konf.data.kembalian === bayar - trx.total, `${rp(bayar)} dikurangi ${rp(trx.total)} sama dengan ${rp(konf.data.kembalian)}`);

const stokSetelahBayar = (await panggil(`/produk/${produk.id}`)).data.stok;
cek('Stok berkurang 3 setelah dibayar', stokSetelahBayar === stokAwal - 3, `${stokAwal} jadi ${stokSetelahBayar}`);

const kartu = (await panggil(`/stok/${produk.id}/kartu`)).data;
const gerakJual = kartu.pergerakan.find((g) => g.transaksi_id === trx.id);
cek('Penjualan tercatat di buku pergerakan stok', Boolean(gerakJual), `jenis ${gerakJual?.jenis}, jumlah ${gerakJual?.jumlah}`);

// 3. Data pembeli
console.log('\n3. DATA PEMBELI DAN STRUK');
const pembeli = await panggil(`/transaksi/${trx.id}/pembeli`, {
  method: 'PATCH',
  body: JSON.stringify({ nama_pembeli: 'Uji Coba', nomor_wa: '081234567890' }),
});
cek('Nomor WhatsApp dibakukan jadi 62', pembeli.data.nomor_wa === '6281234567890', pembeli.data.nomor_wa);
cek('Struk masuk antrian kirim', pembeli.data.status_struk === 'menunggu_kirim');

const strukPublik = await panggil(`/struk/publik/${trx.kode_struk}`);
cek('Struk bisa dibuka tanpa login', strukPublik.status === 200);
cek('Struk tidak membocorkan id transaksi', strukPublik.data.id === undefined);

const antrian = (await panggil('/struk/antrian')).data.daftar.find((s) => s.id === trx.id);
cek('Muncul di antrian kirim struk', Boolean(antrian));
cek('Link WhatsApp sudah berisi pesan siap kirim', Boolean(antrian?.link_whatsapp?.includes('wa.me/6281234567890')));

// 4. Harga dibekukan
console.log('\n4. PEMBEKUAN HARGA');
const hargaBaru = produk.harga + 7000;
await panggil(`/produk/${produk.id}`, { method: 'PATCH', body: JSON.stringify({ harga: hargaBaru }) });
const strukLagi = await panggil(`/struk/publik/${trx.kode_struk}`);
const barisProduk = strukLagi.data.item.find((i) => i.nama_barang === produk.nama);
cek('Harga di struk lama TIDAK ikut berubah', barisProduk.harga_normal === produk.harga, `struk ${rp(barisProduk.harga_normal)}, harga sekarang ${rp(hargaBaru)}`);
await panggil(`/produk/${produk.id}`, { method: 'PATCH', body: JSON.stringify({ harga: produk.harga }) });

// 5. Penjagaan stok
console.log('\n5. PENJAGAAN STOK');
const kebanyakan = await panggil('/transaksi', {
  method: 'POST',
  body: JSON.stringify({ item: [{ jenis_barang: 'produk', barang_id: produk.id, jumlah: 99999 }] }),
});
cek('Beli melebihi stok ditolak', kebanyakan.status === 400, kebanyakan.pesan);

const kurangTanpaAlasan = await panggil(`/stok/${produk.id}/kurang`, {
  method: 'POST',
  body: JSON.stringify({ jumlah: 1 }),
});
cek('Kurangi stok tanpa alasan ditolak', kurangTanpaAlasan.status === 400, kurangTanpaAlasan.pesan);

// 6. Pembatalan
console.log('\n6. PEMBATALAN');
const batal = await panggil(`/transaksi/${trx.id}/batal`, {
  method: 'POST',
  body: JSON.stringify({ alasan: 'Uji coba otomatis' }),
});
cek('Transaksi selesai bisa dibatalkan', batal.status === 200);
const stokSetelahBatal = (await panggil(`/produk/${produk.id}`)).data.stok;
cek('Stok kembali seperti semula', stokSetelahBatal === stokAwal, `${stokSetelahBayar} jadi ${stokSetelahBatal}`);

const kartu2 = (await panggil(`/stok/${produk.id}/kartu`)).data;
const gerakBatal = kartu2.pergerakan.find((g) => g.jenis === 'pembatalan' && g.transaksi_id === trx.id);
cek('Pengembalian dicatat sebagai baris BARU', Boolean(gerakBatal), `plus ${gerakBatal?.jumlah}`);
cek('Baris penjualan lama tetap utuh', kartu2.pergerakan.some((g) => g.jenis === 'penjualan' && g.transaksi_id === trx.id));

// 7. Log
console.log('\n7. LOG AKTIVITAS');
const log = (await panggil(`/log?entitas=transaksi&entitas_id=${trx.id}&per_halaman=20`)).data.daftar;
const adaAksi = (a) => log.some((l) => l.aksi === a);
cek('Diskon kasir tercatat', adaAksi('beri_diskon_transaksi'));
cek('Konfirmasi pembayaran tercatat', adaAksi('konfirmasi_pembayaran'));
cek('Pembatalan tercatat', adaAksi('batal_transaksi'));
cek('Nama pelaku ikut tercatat', log.every((l) => Boolean(l.nama_user)), log[0]?.nama_user);

// 8. Pemeriksaan silang
console.log('\n8. PEMERIKSAAN SILANG STOK');
const semua = (await panggil('/stok')).data;
const beda = semua.filter((p) => !p.cocok);
cek('Semua stok cocok dengan buku pergerakan', beda.length === 0, beda.length ? beda.map((b) => b.nama).join(', ') : `${semua.length} produk diperiksa`);

console.log('\n' + '='.repeat(62));
console.log(gagal === 0 ? '  SEMUA UJI LULUS' : `  ADA ${gagal} UJI YANG GAGAL`);
console.log('='.repeat(62) + '\n');
process.exit(gagal === 0 ? 0 : 1);
