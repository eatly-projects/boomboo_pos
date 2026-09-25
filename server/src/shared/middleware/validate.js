import { KesalahanAplikasi } from './error.js';

/** "harga_diskon" -> "Harga diskon" */
const namaKolom = (jalur) => {
  const teks = String(jalur || 'Data').replaceAll('_', ' ').replaceAll('.', ' ');
  return teks.charAt(0).toUpperCase() + teks.slice(1);
};

/**
 * Pesan bawaan zod berbahasa Inggris. Pengguna aplikasi ini orang awam dan
 * staf lapangan, jadi semua pesan yang sampai ke layar harus bahasa Indonesia.
 */
function keBahasaIndonesia(masalah) {
  const kolom = namaKolom(masalah.path.join('.'));

  if (masalah.code === 'invalid_type') {
    if (masalah.received === 'undefined' || masalah.received === 'null')
      return `${kolom} wajib diisi.`;
    if (masalah.expected === 'number') return `${kolom} harus berupa angka.`;
    if (masalah.expected === 'string') return `${kolom} harus berupa teks.`;
    return `${kolom} tidak sesuai.`;
  }

  // Pesan yang sudah ditulis sendiri di skema dipakai apa adanya
  if (masalah.message && !/^(Required|Invalid|Expected)/.test(masalah.message))
    return masalah.message;

  if (masalah.code === 'too_small') return `${kolom} terlalu kecil atau kosong.`;
  if (masalah.code === 'too_big') return `${kolom} terlalu besar.`;
  if (masalah.code === 'invalid_enum_value') return `Pilihan ${kolom.toLowerCase()} tidak dikenal.`;
  if (masalah.code === 'invalid_string') return `Format ${kolom.toLowerCase()} belum benar.`;

  return `${kolom} belum benar.`;
}

/**
 * Memeriksa bentuk data yang masuk memakai skema zod.
 *
 *   router.post('/', periksa(skemaProduk), controller.tambah)
 */
export const periksa = (skema, sumber = 'body') => (req, _res, next) => {
  const hasil = skema.safeParse(req[sumber]);
  if (!hasil.success) {
    const rincian = hasil.error.issues.map((i) => ({
      kolom: i.path.join('.'),
      pesan: keBahasaIndonesia(i),
    }));
    return next(
      new KesalahanAplikasi(
        rincian[0]?.pesan || 'Data yang dikirim belum lengkap atau tidak sesuai.',
        400,
        rincian
      )
    );
  }
  req[sumber] = hasil.data;
  next();
};
