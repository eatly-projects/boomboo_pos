import { KesalahanAplikasi, tidakDitemukan } from '../middleware/error.js';

/**
 * SATU-SATUNYA pintu untuk mengubah stok.
 *
 * Tidak ada tempat lain di aplikasi ini yang boleh menyentuh kolom
 * `produk.stok` secara langsung. Semua perubahan lewat sini, supaya:
 *
 *   1. Angka stok dan buku besar `pergerakan_stok` selalu cocok.
 *      Jumlah semua baris buku besar HARUS sama dengan produk.stok.
 *   2. Setiap perubahan selalu punya jejak: berapa, kenapa, dan siapa.
 *   3. Dua kasir yang menekan tombol pada detik yang sama tidak saling
 *      menimpa - barisnya dikunci dengan `for update`, jadi yang satu
 *      menunggu yang lain selesai.
 *
 * WAJIB dipanggil di dalam transaksi basis data (lihat dalamTransaksi).
 *
 * @param jumlah  positif untuk menambah, negatif untuk mengurangi
 * @param bolehMinus  hanya `true` pada satu kasus: pembayaran sudah diterima
 *                    tapi stok keburu diambil kasir lain (aturan 5.6).
 */
export async function gerakkanStok(
  klien,
  { produkId, jenis, jumlah, alasan = null, catatan = null, transaksiId = null, user, bolehMinus = false }
) {
  if (!Number.isInteger(jumlah) || jumlah === 0)
    throw new KesalahanAplikasi('Jumlah stok harus angka bulat dan tidak boleh nol.', 400);

  // `for update` mengunci baris produk sampai transaksi ini selesai.
  const { rows } = await klien.query(
    'select id, nama, stok from produk where id = $1 for update',
    [produkId]
  );
  const produk = rows[0];
  if (!produk) throw tidakDitemukan('Produk tidak ditemukan.');

  const sebelum = produk.stok;
  const sesudah = sebelum + jumlah;

  if (sesudah < 0 && !bolehMinus) {
    throw new KesalahanAplikasi(
      `Stok ${produk.nama} tidak cukup. Sisa ${sebelum}, yang diminta ${Math.abs(jumlah)}.`,
      400
    );
  }

  await klien.query('update produk set stok = $1 where id = $2', [sesudah, produkId]);

  await klien.query(
    `insert into pergerakan_stok
       (produk_id, jenis, jumlah, stok_sebelum, stok_sesudah,
        alasan, catatan, transaksi_id, user_id, nama_user)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      produkId,
      jenis,
      jumlah,
      sebelum,
      sesudah,
      alasan,
      catatan,
      transaksiId,
      user?.id ?? null,
      user?.nama ?? 'Sistem',
    ]
  );

  return {
    produk_id: produkId,
    nama_produk: produk.nama,
    stok_sebelum: sebelum,
    stok_sesudah: sesudah,
    jadi_minus: sesudah < 0,
  };
}

export const ALASAN_PENGURANGAN = ['rusak', 'tumpah', 'hilang', 'koreksi hitungan'];
