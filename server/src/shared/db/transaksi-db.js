import pool from './pool.js';

/**
 * Menjalankan beberapa perintah basis data sebagai SATU kesatuan.
 * Kalau ada satu saja yang gagal, semuanya dibatalkan.
 *
 * Ini dipakai untuk hal-hal yang tidak boleh setengah jadi, misalnya
 * satu penjualan: mengurangi stok, menulis buku besar stok, menyimpan
 * transaksi, dan menulis log aktivitas.
 *
 *   await dalamTransaksi(async (klien) => {
 *     await klien.query('update ...');
 *     await klien.query('insert ...');
 *   });
 */
export async function dalamTransaksi(kerjakan) {
  const klien = await pool.connect();
  try {
    await klien.query('BEGIN');
    const hasil = await kerjakan(klien);
    await klien.query('COMMIT');
    return hasil;
  } catch (e) {
    await klien.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    klien.release();
  }
}
