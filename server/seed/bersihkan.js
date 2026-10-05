/**
 * Mengosongkan data aplikasi kasir.
 *
 * Basis datanya dipakai bersama aplikasi Boomboo yang lain, jadi skrip ini
 * MENOLAK jalan kalau jalur pencarian tabelnya tidak mengarah ke skema milik
 * aplikasi kasir. Tabel pengaturan tidak ikut dikosongkan, hanya gambar QRIS
 * yang dilepas.
 *
 * Pakai:
 *   npm run seed:bersihkan
 *   npm run seed:bersihkan -- --simpan-user
 *   npm run seed:bersihkan -- --simpan-user --simpan-produk
 *
 * --simpan-user   akun pengguna tidak dihapus
 * --simpan-produk daftar produk tidak dihapus, tapi stoknya dinolkan.
 *                 Stok wajib ikut nol supaya jumlah buku besar pergerakan
 *                 tetap sama dengan angka stok - buku besarnya kan dikosongkan.
 *                 Menu tetap dihapus.
 */
import 'dotenv/config';
import pool, { kueri, SKEMA } from '../src/shared/db/pool.js';

const simpanUser = process.argv.includes('--simpan-user');
const simpanProduk = process.argv.includes('--simpan-produk');

// Transaksi dan bill saling menunjuk: sebuah transaksi tahu dia lahir dari
// bill mana, dan sebuah bill tahu dia jadi transaksi mana. Tautan itu harus
// dilepas dulu, kalau tidak urutan penghapusan apa pun akan tertolak.
// Transaksi hasil penukaran juga menunjuk ke transaksi sebelumnya.
const LEPAS_TAUTAN = [
  'update transaksi set bill_id = null, ditukar_dari_id = null, ditukar_ke_id = null',
  'update bill set transaksi_id = null',
];

const URUTAN = [
  'log_aktivitas',
  'pergerakan_stok',
  'penukaran_item',
  'pengembalian_uang',
  'bill_item',
  'transaksi_item',
  'bill',
  'transaksi',
  'kontak_whatsapp',
  'menu_komponen',
  'urutan_nomor',
  'urutan_nomor_bill',
  ...(simpanProduk ? [] : ['produk']),
  'menu',
  ...(simpanUser ? [] : ['users']),
];

try {
  const { rows: cek } = await kueri(
    "select current_setting('search_path') sp, current_database() db"
  );
  if (!cek[0].sp.startsWith(SKEMA)) {
    throw new Error(
      `Jalur pencarian tabel mengarah ke "${cek[0].sp}", bukan skema "${SKEMA}". ` +
        'Dihentikan supaya tidak menghapus data aplikasi lain.'
    );
  }

  console.log(`\nBasis data "${cek[0].db}", skema "${SKEMA}"`);
  console.log(simpanUser ? '  Akun pengguna  : dipertahankan' : '  Akun pengguna  : ikut dihapus');
  console.log(
    simpanProduk
      ? '  Daftar produk  : dipertahankan, stoknya dinolkan'
      : '  Daftar produk  : ikut dihapus'
  );
  console.log('  Menu           : ikut dihapus\n');

  for (const perintah of LEPAS_TAUTAN) await kueri(perintah);

  for (const tabel of URUTAN) {
    const { rowCount } = await kueri(`delete from ${tabel}`);
    console.log(`  ${tabel.padEnd(18)} ${rowCount} baris dihapus`);
  }

  if (simpanProduk) {
    const { rowCount } = await kueri('update produk set stok = 0 where stok <> 0');
    console.log(`  ${'produk (stok)'.padEnd(18)} ${rowCount} produk dinolkan stoknya`);
  }

  await kueri(
    `update pengaturan set nilai = null, diubah_oleh_id = null, nama_pengubah = null
      where kunci in ('qris_gambar_url','qris_gambar_path')`
  );

  // Pemeriksaan silang: jumlah seluruh baris pergerakan harus sama dengan
  // angka stok. Kalau tidak, ada yang salah dan harus ketahuan sekarang.
  const { rows: silang } = await kueri(`
    select count(*)::int n from (
      select p.id from produk p
        left join pergerakan_stok g on g.produk_id = p.id
       group by p.id, p.stok
      having p.stok <> coalesce(sum(g.jumlah), 0)::int
    ) x`);
  if (silang[0].n > 0) {
    throw new Error(`${silang[0].n} produk angka stoknya tidak cocok dengan buku besar.`);
  }

  console.log('\nSelesai. Buku besar stok cocok dengan angka stok.\n');
} catch (e) {
  console.error('\nGAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
