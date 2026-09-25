import { kueri } from '../db/pool.js';

/**
 * Menulis satu baris ke log aktivitas.
 *
 * Kalau dipanggil dari dalam transaksi basis data, berikan `klien`-nya
 * supaya log ikut dibatalkan kalau transaksinya gagal.
 *
 *   await catatLog({ user, aksi: 'tambah_produk', entitas: 'produk', ... })
 *   await catatLog({ ... }, klien)
 */
export async function catatLog(
  { user, aksi, entitas, entitasId = null, namaEntitas = null, detail = null },
  klien = null
) {
  const jalankan = klien ? klien.query.bind(klien) : kueri;
  await jalankan(
    `insert into log_aktivitas
       (user_id, nama_user, aksi, entitas, entitas_id, nama_entitas, detail)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      user?.id ?? null,
      user?.nama ?? 'Sistem',
      aksi,
      entitas,
      entitasId,
      namaEntitas,
      detail ? JSON.stringify(detail) : null,
    ]
  );
}

/**
 * Membandingkan data sebelum dan sesudah, lalu mengembalikan HANYA kolom
 * yang benar-benar berubah. Dipakai supaya isi log ringkas dan enak dibaca.
 */
export function bedanya(sebelum, sesudah, kolom) {
  const hasil = {};
  for (const k of kolom) {
    const a = sebelum?.[k] ?? null;
    const b = sesudah?.[k] ?? null;
    if (String(a) !== String(b)) hasil[k] = { sebelum: a, sesudah: b };
  }
  return Object.keys(hasil).length ? hasil : null;
}
