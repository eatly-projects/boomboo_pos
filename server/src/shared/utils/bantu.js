import crypto from 'node:crypto';

/**
 * Kode acak untuk link struk publik.
 * Sengaja TIDAK memakai nomor urut, supaya orang tidak bisa mengintip
 * struk orang lain hanya dengan menaikkan angka di alamat.
 */
export const kodeAcak = (panjang = 24) =>
  crypto.randomBytes(panjang).toString('base64url').slice(0, panjang);

/**
 * Menyeragamkan nomor WhatsApp ke bentuk 62xxxxxxxxxx.
 * Menerima 08123..., +62812..., 62812..., dan yang berspasi atau bertanda hubung.
 * Mengembalikan null kalau nomornya tidak masuk akal.
 */
export function bakukanNomorWa(mentah) {
  if (!mentah) return null;
  let n = String(mentah).replace(/[^0-9]/g, '');
  if (!n) return null;

  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (n.startsWith('8')) n = '62' + n;
  else if (!n.startsWith('62')) return null;

  // nomor Indonesia yang wajar: 62 + 9 sampai 13 angka
  if (n.length < 11 || n.length > 15) return null;
  return n;
}

/**
 * Menyusun kemungkinan bentuk penulisan nomor untuk keperluan PENCARIAN.
 *
 * Nomor disimpan dalam bentuk baku 62xxxxxxxxxx, sementara orang terbiasa
 * mengetik 08xxxxxxxxxx. Yang diketik juga sering baru sepotong, misalnya
 * "0878" saja, sehingga tidak bisa lewat pembakuan biasa yang mensyaratkan
 * nomor lengkap.
 *
 *   polaNomor('0878')  -> ['0878', '62878']
 *   polaNomor('878')   -> ['878', '62878']
 *   polaNomor('62878') -> ['62878', '0878']
 */
export function polaNomor(teks) {
  const angka = String(teks || '').replace(/[^0-9]/g, '');
  if (!angka) return [];

  const pola = new Set([angka]);
  if (angka.startsWith('0')) pola.add('62' + angka.slice(1));
  else if (angka.startsWith('8')) pola.add('62' + angka);
  else if (angka.startsWith('62')) pola.add('0' + angka.slice(2));

  return [...pola];
}

/** 15000 -> "Rp 15.000" */
export const rupiah = (angka) =>
  'Rp ' + Number(angka || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

/**
 * Menghitung harga yang benar-benar dipakai untuk satu barang.
 * Kalau harga diskon terisi, itulah yang dipakai (keputusan A2).
 */
export const hargaDipakai = (barang) =>
  barang.harga_diskon !== null && barang.harga_diskon !== undefined
    ? barang.harga_diskon
    : barang.harga;

/**
 * Mengambil nomor transaksi berikutnya untuk hari ini, secara atomik.
 * Harus dipanggil di dalam transaksi basis data supaya tidak kembar
 * walaupun beberapa kasir menekan tombol pada detik yang sama.
 */
export async function nomorTransaksiBerikutnya(klien) {
  const { rows } = await klien.query(
    `insert into urutan_nomor (tanggal, terakhir)
     values (current_date, 1)
     on conflict (tanggal) do update set terakhir = urutan_nomor.terakhir + 1
     returning tanggal, terakhir`
  );
  const { tanggal, terakhir } = rows[0];
  const t = new Date(tanggal);
  const tgl =
    t.getFullYear().toString() +
    String(t.getMonth() + 1).padStart(2, '0') +
    String(t.getDate()).padStart(2, '0');
  return `BB-${tgl}-${String(terakhir).padStart(4, '0')}`;
}

/** Menyusun bagian LIMIT/OFFSET dari pertanyaan halaman. */
export function halaman(query) {
  const perHalaman = Math.min(Math.max(Number(query.per_halaman) || 25, 1), 200);
  const halamanKe = Math.max(Number(query.halaman) || 1, 1);
  return { perHalaman, halamanKe, lewati: (halamanKe - 1) * perHalaman };
}
