/**
 * Mengosongkan seluruh data contoh.
 * Tabel pengaturan dan bucket penyimpanan TIDAK ikut dikosongkan.
 *
 * Pakai:  npm run seed:bersihkan
 */
import 'dotenv/config';
import pool, { kueri } from '../src/shared/db/pool.js';

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
  'produk',
  'menu',
  'users',
];

try {
  console.log('\nMengosongkan data...\n');
  for (const tabel of URUTAN) {
    const { rowCount } = await kueri(`delete from ${tabel}`);
    console.log(`  ${tabel.padEnd(18)} ${rowCount} baris dihapus`);
  }
  await kueri(
    `update pengaturan set nilai = null, diubah_oleh_id = null, nama_pengubah = null
      where kunci in ('qris_gambar_url','qris_gambar_path')`
  );
  console.log('\nSelesai. Basis data sudah kosong.\n');
} catch (e) {
  console.error('GAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
