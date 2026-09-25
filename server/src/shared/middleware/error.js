/**
 * Kesalahan yang memang sengaja dibuat oleh aplikasi, lengkap dengan
 * kode status HTTP dan pesan yang aman ditampilkan ke pengguna.
 */
export class KesalahanAplikasi extends Error {
  constructor(pesan, status = 400, rincian = undefined) {
    super(pesan);
    this.status = status;
    this.rincian = rincian;
    this.disengaja = true;
  }
}

export const tidakDitemukan = (pesan = 'Data tidak ditemukan') =>
  new KesalahanAplikasi(pesan, 404);

export const tidakBoleh = (pesan = 'Anda tidak berhak melakukan ini') =>
  new KesalahanAplikasi(pesan, 403);

export const belumMasuk = (pesan = 'Silakan masuk terlebih dahulu') =>
  new KesalahanAplikasi(pesan, 401);

/** Pembungkus supaya controller tidak perlu menulis try/catch berulang kali. */
export const tangkap = (fungsi) => (req, res, next) =>
  Promise.resolve(fungsi(req, res, next)).catch(next);

/** Penanganan kesalahan terakhir. Dipasang paling bawah di app.js */
export function penanganKesalahan(err, req, res, _next) {
  if (err?.disengaja) {
    return res.status(err.status).json({
      sukses: false,
      pesan: err.message,
      rincian: err.rincian,
    });
  }

  // Pelanggaran aturan basis data diterjemahkan ke bahasa manusia
  if (err?.code === '23505') {
    return res.status(409).json({
      sukses: false,
      pesan: 'Data ini sudah ada sebelumnya.',
    });
  }
  if (err?.code === '23503') {
    return res.status(409).json({
      sukses: false,
      pesan: 'Data ini masih dipakai di tempat lain, jadi tidak bisa diproses.',
    });
  }
  if (err?.code === '23514') {
    return res.status(400).json({
      sukses: false,
      pesan: 'Data yang dikirim tidak memenuhi aturan yang berlaku.',
    });
  }

  console.error('[kesalahan tak terduga]', err);
  return res.status(500).json({
    sukses: false,
    pesan: 'Terjadi kesalahan di server. Silakan coba lagi.',
  });
}
