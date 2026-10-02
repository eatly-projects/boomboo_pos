/**
 * Mengisi basis data dengan user dan data contoh, seolah-olah aplikasi ini
 * sudah dipakai berjualan selama beberapa hari.
 *
 * Data dibuat lewat layanan aslinya (bukan ditulis langsung ke tabel), supaya
 * seluruh aturan bisnis, buku besar stok, dan log aktivitas ikut terbentuk
 * persis seperti pemakaian sungguhan. Setelah itu waktunya digeser ke belakang
 * supaya terlihat seperti riwayat beberapa hari terakhir.
 *
 * Pakai:  npm run seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool, { kueri } from '../src/shared/db/pool.js';
import * as produkService from '../src/features/produk/produk.service.js';
import * as menuService from '../src/features/menu/menu.service.js';
import * as stokService from '../src/features/stok/stok.service.js';
import * as trxService from '../src/features/transaksi/transaksi.service.js';
import * as billService from '../src/features/bill/bill.service.js';

/* ------------------------------------------------------------------ */
/* Alat bantu acak                                                     */
/* ------------------------------------------------------------------ */
const acakInt = (min, maks) => Math.floor(Math.random() * (maks - min + 1)) + min;
const acakDari = (arr) => arr[Math.floor(Math.random() * arr.length)];
const peluang = (persen) => Math.random() * 100 < persen;

/* ------------------------------------------------------------------ */
/* 1. User                                                             */
/* ------------------------------------------------------------------ */
const KATA_SANDI = 'boomboo123';

// Dua akun pertama adalah akun ASLI milik tim, kata sandinya berbeda dan
// diambil dari peubah lingkungan supaya tidak tertulis di dalam kode.
// Tiga sisanya akun contoh yang dipakai data dummy.
const SANDI_ASLI = process.env.SANDI_AKUN_ASLI || KATA_SANDI;

const DAFTAR_USER = [
  { nama: 'Lutfi Apriamto', email: 'lutfi_new@boomboo.id', role: 'pemilik', sandi: SANDI_ASLI, asli: true },
  { nama: 'Ari', email: 'ari_manager@boomboo.id', role: 'manajer', sandi: SANDI_ASLI, asli: true },
  { nama: 'Lutfi Hakim', email: 'lutfi@boomboo.id', role: 'pemilik' },
  { nama: 'Sari Wulandari', email: 'sari@boomboo.id', role: 'manajer' },
  { nama: 'Bagus Prakoso', email: 'bagus@boomboo.id', role: 'kasir' },
];

async function buatUser() {
  const hasil = [];
  for (const u of DAFTAR_USER) {
    const hash = await bcrypt.hash(u.sandi || KATA_SANDI, 10);
    const { rows } = await kueri(
      `insert into users (nama, email, password_hash, role)
       values ($1,$2,$3,$4)
       on conflict (email) do update set nama = excluded.nama, role = excluded.role
       returning id, nama, email, role`,
      [u.nama, u.email, hash, u.role]
    );
    hasil.push(rows[0]);
  }
  return hasil;
}

/* ------------------------------------------------------------------ */
/* 2. Katalog                                                          */
/* ------------------------------------------------------------------ */
const PRODUK = [
  { nama: 'Sambal Goreng Daun Jeruk 100g', harga: 35000, harga_diskon: 29000, nama_diskon: 'Promo Event', stok: 180 },
  { nama: 'Sambal Goreng Daun Jeruk 200g', harga: 60000, harga_diskon: 52000, nama_diskon: 'Promo Event', stok: 120 },
  { nama: 'Sambal Bawang Boombastis 100g', harga: 35000, stok: 165 },
  { nama: 'Sambal Bawang Boombastis 200g', harga: 60000, stok: 110 },
  { nama: 'Sambal Cumi Pedas 100g', harga: 45000, harga_diskon: 39000, nama_diskon: 'Promo Event', stok: 95 },
  { nama: 'Sambal Cumi Pedas 200g', harga: 80000, stok: 60 },
  { nama: 'Sambal Teri Medan 100g', harga: 42000, stok: 88 },
  { nama: 'Sambal Rawit Ijo 100g', harga: 38000, stok: 76 },
  { nama: 'Paket Hemat Isi 3 Botol', harga: 95000, harga_diskon: 89000, nama_diskon: 'Bundling Bazar', stok: 45 },
  { nama: 'Kerupuk Bawang 80g', harga: 20000, stok: 140 },
  { nama: 'Kaos Boomboo', harga: 120000, stok: 36 },
  { nama: 'Tote Bag Boomboo', harga: 65000, stok: 52 },

  // Bahan yang stoknya dicatat untuk keperluan menu (permintaan R6.1).
  // Air mineral dijual satuan DAN dipakai sebagai penyusun menu.
  { nama: 'Air Mineral 600ml', harga: 5000, stok: 300 },
  // Mie instan hanya dipakai di dalam menu, tidak dijual sendiri.
  { nama: 'Mie Instan Goreng', harga: 8000, stok: 220, dijual_satuan: false },
  { nama: 'Telur Ayam', harga: 4000, stok: 180, dijual_satuan: false },
];

const MENU = [
  // Menu TANPA penyusun: nasi dan ayamnya tidak dihitung satuan (K39)
  { nama: 'Nasi Ayam Sambal Bawang', harga: 30000 },
  { nama: 'Nasi Ayam Sambal Daun Jeruk', harga: 30000 },
  { nama: 'Nasi Goreng Boombastis', harga: 32000 },
  { nama: 'Es Teh Manis', harga: 8000 },
  { nama: 'Es Jeruk Peras', harga: 10000 },

  // Menu DENGAN penyusun berstok (permintaan R6.2)
  {
    nama: 'Mie Boombastis Spesial',
    harga: 25000,
    penyusun: [['Mie Instan Goreng', 1], ['Telur Ayam', 1]],
  },
  {
    nama: 'Paket Mie + Air Mineral',
    harga: 30000,
    harga_diskon: 27000,
    nama_diskon: 'Paket Hemat',
    penyusun: [['Mie Instan Goreng', 1], ['Air Mineral 600ml', 1]],
  },
  {
    nama: 'Paket Komplit Nasi Ayam + Es Teh',
    harga: 40000,
    harga_diskon: 35000,
    nama_diskon: 'Paket Hemat',
    penyusun: [['Air Mineral 600ml', 1]],
  },
  {
    nama: 'Nasi Telur Sambal Cumi',
    harga: 28000,
    harga_diskon: 25000,
    nama_diskon: 'Promo Makan Siang',
    penyusun: [['Telur Ayam', 2]],
  },
];

async function buatKatalog(pemilik, manajer) {
  const produk = [];
  for (const p of PRODUK) {
    const { stok, ...data } = p;
    const dibuat = await produkService.tambah(data, pemilik);
    await stokService.tambah(
      dibuat.id,
      { jumlah: stok, catatan: 'Stok awal dari gudang' },
      pemilik
    );
    produk.push({ ...dibuat, stok_awal: stok });
  }

  const perNama = new Map(produk.map((p) => [p.nama, p.id]));

  const menu = [];
  for (const m of MENU) {
    const { penyusun, ...data } = m;
    if (penyusun) {
      data.komponen = penyusun.map(([nama, jumlah]) => ({
        produk_id: perNama.get(nama),
        jumlah,
      }));
    }
    menu.push(await menuService.tambah(data, manajer));
  }

  return { produk, menu };
}

/** Beberapa pengurangan stok manual, supaya riwayatnya terlihat wajar. */
async function kurangiStokWajar(produk, user) {
  const kejadian = [
    { nama: 'Sambal Goreng Daun Jeruk 100g', jumlah: 3, alasan: 'rusak', catatan: 'Tutup botol penyok saat bongkar muat' },
    { nama: 'Sambal Cumi Pedas 100g', jumlah: 2, alasan: 'tumpah', catatan: 'Jatuh dari meja display' },
    { nama: 'Kerupuk Bawang 80g', jumlah: 5, alasan: 'rusak', catatan: 'Kemasan bocor' },
    { nama: 'Sambal Bawang Boombastis 200g', jumlah: 1, alasan: 'hilang', catatan: 'Tidak ketemu saat hitung ulang' },
    { nama: 'Tote Bag Boomboo', jumlah: 2, alasan: 'rusak', catatan: 'Jahitan lepas' },
  ];
  for (const k of kejadian) {
    const p = produk.find((x) => x.nama === k.nama);
    if (p) await stokService.kurang(p.id, k, user);
  }
}

/* ------------------------------------------------------------------ */
/* 3. Pembeli contoh                                                   */
/* ------------------------------------------------------------------ */
const NAMA_DEPAN = ['Andi','Siti','Budi','Rina','Dimas','Putri','Yoga','Maya','Fajar','Dewi','Rizki','Nabila','Hendra','Intan','Galih','Vina','Arif','Lina','Bayu','Citra','Eka','Tomi','Ayu','Reza','Fitri','Adit','Nanda','Wulan','Iqbal','Sinta'];
const NAMA_BELAKANG = ['Pratama','Rahayu','Saputra','Wijaya','Lestari','Nugroho','Anggraini','Kusuma','Permata','Santoso','Handayani','Firdaus','Maharani','Setiawan','Puspita'];

const nomorAcak = () =>
  '08' + acakDari(['1', '2', '5', '7', '8']) + acakInt(10000000, 99999999).toString();

const namaAcak = () => `${acakDari(NAMA_DEPAN)} ${acakDari(NAMA_BELAKANG)}`;

/* ------------------------------------------------------------------ */
/* 4. Transaksi                                                        */
/* ------------------------------------------------------------------ */

/** Menyusun satu keranjang yang masuk akal. */
function susunKeranjang(produk, menu) {
  const item = [];
  // Hanya produk yang dijual satuan yang bisa masuk keranjang (R6.1)
  const bisaDijual = produk.filter((p) => p.dijual_satuan !== false);
  const jumlahProduk = acakInt(0, 3);
  const jumlahMenu = acakInt(0, 3);

  for (let i = 0; i < jumlahProduk; i++) {
    const p = acakDari(bisaDijual);
    item.push({ jenis_barang: 'produk', barang_id: p.id, jumlah: acakInt(1, 3) });
  }
  for (let i = 0; i < jumlahMenu; i++) {
    const m = acakDari(menu);
    item.push({ jenis_barang: 'menu', barang_id: m.id, jumlah: acakInt(1, 2) });
  }
  // pastikan keranjang tidak pernah kosong
  if (item.length === 0) {
    const m = acakDari(menu);
    item.push({ jenis_barang: 'menu', barang_id: m.id, jumlah: 1 });
  }
  return item;
}

async function buatTransaksiHarian({ produk, menu, kasirTersedia, jumlah }) {
  const dibuat = [];

  for (let i = 0; i < jumlah; i++) {
    const kasir = acakDari(kasirTersedia);
    const item = susunKeranjang(produk, menu);

    // sekitar 1 dari 6 transaksi diberi diskon oleh kasir
    let diskon_jenis = null;
    let diskon_nilai = null;
    if (peluang(17)) {
      if (peluang(60)) {
        diskon_jenis = 'persen';
        diskon_nilai = acakDari([5, 10, 15]);
      } else {
        diskon_jenis = 'nominal';
        diskon_nilai = acakDari([5000, 10000, 15000, 20000]);
      }
    }

    let trx;
    try {
      trx = await trxService.buat({ item, diskon_jenis, diskon_nilai }, kasir);
    } catch {
      continue; // stok habis - wajar, lewati saja
    }

    // sekitar 4% transaksi batal sebelum dibayar
    if (peluang(4)) {
      await trxService.batal(trx.id, { alasan: acakDari(['Pembeli berubah pikiran', 'Salah input barang', 'Pembayaran gagal']) }, kasir);
      dibuat.push({ id: trx.id, status: 'batal' });
      continue;
    }

    // Semua pembayaran lewat QRIS (permintaan R1)
    await trxService.konfirmasi(trx.id, {}, kasir);

    // sekitar 7 dari 10 pembeli mau memberikan nomor WhatsApp
    if (peluang(70)) {
      await trxService.isiPembeli(
        trx.id,
        { nama_pembeli: peluang(80) ? namaAcak() : null, nomor_wa: nomorAcak() },
        kasir
      );
    } else {
      await trxService.lewatiStruk(trx.id);
    }

    dibuat.push({ id: trx.id, status: 'selesai' });
  }

  return dibuat;
}

/* ------------------------------------------------------------------ */
/* 4b. Open Bill                                                       */
/* ------------------------------------------------------------------ */

const PENANDA = ['Meja 1', 'Meja 2', 'Meja 3', 'Meja 5', 'Dekat panggung', 'Baju merah', 'Rombongan kantor'];

/**
 * Membuat beberapa bill: sebagian masih terbuka supaya halamannya ada isinya,
 * sebagian sudah ditutup dan dibayar supaya alurnya terbukti jalan sampai
 * selesai, dan satu dibatalkan supaya pengembalian stoknya ikut tercatat.
 */
async function buatBill({ produk, menu, kasirTersedia }) {
  const bisaDijual = produk.filter((p) => p.dijual_satuan !== false);
  const hasil = { terbuka: 0, selesai: 0, batal: 0 };

  for (let i = 0; i < 9; i++) {
    const kasir = acakDari(kasirTersedia);
    const bill = await billService.buka(
      {
        nama_pembeli: namaAcak(),
        nomor_wa: peluang(80) ? nomorAcak() : null,
        penanda: peluang(70) ? acakDari(PENANDA) : null,
      },
      kasir
    );

    // Pesanan datang bertahap, kadang dari kasir yang berbeda
    for (let n = 0; n < acakInt(2, 5); n++) {
      const pakaiMenu = peluang(60);
      const barang = pakaiMenu ? acakDari(menu) : acakDari(bisaDijual);
      try {
        await billService.tambahItem(
          bill.id,
          {
            jenis_barang: pakaiMenu ? 'menu' : 'produk',
            barang_id: barang.id,
            jumlah: acakInt(1, 2),
          },
          acakDari(kasirTersedia)
        );
      } catch {
        // stok habis, lewati saja
      }
    }

    if (i < 4) {
      hasil.terbuka++;
      continue;
    }
    if (i === 4) {
      await billService.batal(bill.id, { alasan: 'Pembeli pergi tanpa memesan lagi' }, kasir);
      hasil.batal++;
      continue;
    }

    try {
      const trx = await billService.tutup(
        bill.id,
        peluang(30) ? { diskon_jenis: 'persen', diskon_nilai: 10 } : {},
        kasir
      );
      await trxService.konfirmasi(trx.id, {}, kasir);
      hasil.selesai++;
    } catch {
      hasil.terbuka++;
    }
  }

  return hasil;
}

/* ------------------------------------------------------------------ */
/* 5. Menggeser waktu ke belakang                                      */
/* ------------------------------------------------------------------ */

/**
 * Menggeser seluruh jejak waktu satu kumpulan transaksi ke tanggal tertentu,
 * lengkap dengan buku besar stok dan log aktivitasnya, supaya datanya
 * terlihat seperti riwayat beberapa hari lalu.
 *
 * Nomor transaksi ikut ditulis ulang agar cocok dengan tanggal barunya.
 */
async function geserKeTanggal(idTransaksi, tanggal, urutanMulai) {
  if (!idTransaksi.length) return;

  // Jam buka lapak: 10.00 - 21.00 WIB (UTC+7).
  // Khusus HARI INI jamnya dibatasi sampai jam sekarang, supaya transaksi
  // contoh tidak pernah tampak dibuat di masa depan dan menenggelamkan
  // transaksi sungguhan yang baru saja dibuat.
  const sekarangWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const hariIni = tanggal.mundur === 0;
  const jamMaks = hariIni ? Math.max(sekarangWib.getUTCHours() - 1, 10) : 20;

  // Seluruh jam dibuat dulu lalu DIURUTKAN, baru dipasangkan satu per satu.
  // Kalau jamnya diacak sambil nomor dibagikan berurutan, nomor dan jam jadi
  // tidak nyambung - bisa muncul nomor 0019 pada pukul 13.05 padahal nomor
  // 0013 pada pukul 13.29. Daftar yang sebenarnya sudah urut jadi terlihat
  // berantakan di layar.
  const daftarWaktu = idTransaksi
    .map(() =>
      new Date(
        Date.UTC(
          tanggal.y,
          tanggal.m - 1,
          tanggal.d,
          acakInt(10, Math.max(jamMaks, 10)) - 7,
          acakInt(0, 59),
          acakInt(0, 59)
        )
      )
    )
    .sort((a, b) => a - b);

  let urut = urutanMulai;
  for (let i = 0; i < idTransaksi.length; i++) {
    const id = idTransaksi[i];
    const waktu = daftarWaktu[i];
    const selesai = new Date(waktu.getTime() + acakInt(40, 240) * 1000);

    const nomor = `BB-${tanggal.y}${String(tanggal.m).padStart(2, '0')}${String(tanggal.d).padStart(2, '0')}-${String(urut).padStart(4, '0')}`;
    urut++;

    await kueri(
      `update transaksi
          set nomor = $1,
              dibuat_pada = $2::timestamptz,
              dikonfirmasi_pada = case when dikonfirmasi_pada is null then null else $3::timestamptz end,
              dibatalkan_pada   = case when dibatalkan_pada   is null then null else $3::timestamptz end
        where id = $4`,
      [nomor, waktu, selesai, id]
    );
    await kueri('update pergerakan_stok set dibuat_pada = $1 where transaksi_id = $2', [selesai, id]);
    await kueri(
      `update log_aktivitas set dibuat_pada = $1 where entitas = 'transaksi' and entitas_id = $2`,
      [selesai, id]
    );
  }
  return urut;
}

/* ------------------------------------------------------------------ */
/* Jalankan                                                            */
/* ------------------------------------------------------------------ */
async function jalankan() {
  console.log('\nMengisi data contoh Boomboo\n' + '='.repeat(48));

  const { rows: sudahAda } = await kueri('select count(*)::int as n from transaksi');
  if (sudahAda[0].n > 0) {
    console.log(`\nBasis data sudah berisi ${sudahAda[0].n} transaksi.`);
    console.log('Kosongkan dulu dengan: npm run seed:bersihkan\n');
    return;
  }

  const semuaUser = await buatUser();
  const [, , pemilik, manajer, kasir] = semuaUser;
  console.log(`\n1. User dibuat: ${DAFTAR_USER.length} orang`);
  DAFTAR_USER.forEach((u) => console.log(`   - ${u.nama.padEnd(18)} ${u.email.padEnd(20)} (${u.role})`));

  const { produk, menu } = await buatKatalog(pemilik, manajer);
  console.log(`\n2. Katalog dibuat: ${produk.length} produk, ${menu.length} menu`);

  await kurangiStokWajar(produk, manajer);
  console.log('3. Pengurangan stok manual dicatat (rusak, tumpah, hilang)');

  // Riwayat 6 hari ke belakang, hari ini termasuk
  const hariIni = new Date();
  const semuaHari = [];
  for (let mundur = 6; mundur >= 0; mundur--) {
    const t = new Date(hariIni);
    t.setDate(t.getDate() - mundur);
    semuaHari.push({ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate(), mundur });
  }

  console.log('\n4. Membuat riwayat transaksi:');
  let totalTransaksi = 0;

  for (const hari of semuaHari) {
    // akhir pekan lebih ramai
    const tanggalJs = new Date(hari.y, hari.m - 1, hari.d);
    const akhirPekan = [0, 6].includes(tanggalJs.getDay());
    const jumlah = akhirPekan ? acakInt(28, 40) : acakInt(14, 26);

    const dibuat = await buatTransaksiHarian({
      produk,
      menu,
      kasirTersedia: [pemilik, manajer, kasir],
      jumlah,
    });

    await geserKeTanggal(dibuat.map((d) => d.id), hari, 1);
    totalTransaksi += dibuat.length;

    const tgl = `${String(hari.d).padStart(2, '0')}/${String(hari.m).padStart(2, '0')}`;
    console.log(`   ${tgl}${akhirPekan ? ' (akhir pekan)' : '              '}  ${String(dibuat.length).padStart(3)} transaksi`);
  }

  const bill = await buatBill({ produk, menu, kasirTersedia: [pemilik, manajer, kasir] });
  console.log(
    `
5. Open Bill: ${bill.terbuka} masih terbuka, ${bill.selesai} sudah dibayar, ${bill.batal} dibatalkan`
  );

  // Sebagian struk ditandai sudah terkirim, sisanya sengaja dibiarkan
  // menunggu supaya halaman Antrian Kirim Struk ada isinya.
  await kueri(
    `update transaksi set status_struk = 'terkirim'
      where status_struk = 'menunggu_kirim'
        and dikonfirmasi_pada < now() - interval '1 day'
        and random() < 0.85`
  );

  console.log(`
   Jumlah transaksi dibuat: ${totalTransaksi}`);
  await tampilkanRingkasan();
}

async function tampilkanRingkasan() {
  const { rows: r } = await kueri(`
    select
      (select count(*)::int from users)             as users,
      (select count(*)::int from produk)            as produk,
      (select count(*)::int from menu)              as menu,
      (select count(*)::int from transaksi)         as transaksi,
      (select count(*)::int from transaksi where status='selesai') as selesai,
      (select count(*)::int from transaksi where status='batal')   as batal,
      (select count(*)::int from transaksi_item)    as item,
      (select count(*)::int from pergerakan_stok)   as pergerakan,
      (select count(*)::int from log_aktivitas)     as log,
      (select count(*)::int from kontak_whatsapp)   as kontak,
      (select coalesce(sum(total),0)::bigint from transaksi where status='selesai') as omzet,
      (select count(*)::int from transaksi where status_struk='menunggu_kirim') as antrian
  `);
  const d = r[0];

  console.log('\n' + '='.repeat(48));
  console.log('Selesai. Isi basis data sekarang:\n');
  console.log(`   User                  : ${d.users}`);
  console.log(`   Produk                : ${d.produk}`);
  console.log(`   Menu                  : ${d.menu}`);
  console.log(`   Transaksi             : ${d.transaksi}  (${d.selesai} selesai, ${d.batal} batal)`);
  console.log(`   Baris barang terjual  : ${d.item}`);
  console.log(`   Pergerakan stok       : ${d.pergerakan}`);
  console.log(`   Log aktivitas         : ${d.log}`);
  console.log(`   Kontak WhatsApp       : ${d.kontak}`);
  const { rows: b } = await kueri(`
    select count(*)::int as semua,
           count(*) filter (where status='terbuka')::int as terbuka,
           (select count(*)::int from menu_komponen) as komponen,
           (select count(*)::int from produk where not dijual_satuan) as tak_dijual_satuan
      from bill`);
  console.log(`   Bill                  : ${b[0].semua}  (${b[0].terbuka} masih terbuka)`);
  console.log(`   Penyusun menu         : ${b[0].komponen} baris`);
  console.log(`   Produk bukan satuan   : ${b[0].tak_dijual_satuan}`);
  console.log(`   Struk menunggu kirim  : ${d.antrian}`);
  console.log(`   Total omzet           : Rp ${Number(d.omzet).toLocaleString('id-ID')}`);

  const { rows: periksa } = await kueri('select * from periksa_stok where selisih <> 0');
  console.log(
    `\n   Pemeriksaan silang stok: ${periksa.length === 0 ? 'COCOK SEMUA' : periksa.length + ' produk tidak cocok'}`
  );

  console.log(`\n   Masuk aplikasi pakai kata sandi: ${KATA_SANDI}\n`);
}

jalankan()
  .catch((e) => {
    console.error('\nGAGAL:', e.message);
    console.error(e.stack.split('\n').slice(0, 5).join('\n'));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
