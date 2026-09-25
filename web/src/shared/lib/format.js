/**
 * Semua tampilan angka dan tanggal lewat berkas ini.
 *
 * Aturannya: pengguna akhirnya orang awam dan staf lapangan, jadi
 * TIDAK ADA singkatan, angka tidak dipotong, dan rentang tanggal ditulis
 * lengkap supaya bisa dipahami sekali lihat.
 */

export const rupiah = (angka) =>
  'Rp ' + Number(angka || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

/** Tanpa "Rp", untuk di dalam tabel yang sudah jelas kolom uangnya. */
export const angka = (n) => Number(n || 0).toLocaleString('id-ID');

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const keTanggal = (nilai) => (nilai instanceof Date ? nilai : new Date(nilai));

/** 7 Oktober 2026 */
export function tanggalPanjang(nilai) {
  if (!nilai) return '-';
  const d = keTanggal(nilai);
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Rabu, 7 Oktober 2026 */
export function tanggalLengkap(nilai) {
  if (!nilai) return '-';
  const d = keTanggal(nilai);
  return `${NAMA_HARI[d.getDay()]}, ${tanggalPanjang(d)}`;
}

/** 7 Oktober 2026, 14.35 */
export function tanggalJam(nilai) {
  if (!nilai) return '-';
  const d = keTanggal(nilai);
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  return `${tanggalPanjang(d)}, ${jam}.${menit}`;
}

/** 14.35 */
export function jam(nilai) {
  if (!nilai) return '-';
  const d = keTanggal(nilai);
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 7 Oktober (tanpa tahun, untuk sumbu grafik) */
export function tanggalPendek(nilai) {
  if (!nilai) return '-';
  const d = keTanggal(nilai);
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)}`;
}

/**
 * Rentang tanggal ditulis eksplisit, tidak pernah disingkat jadi "7 hari".
 *   1 - 7 September 2026
 *   28 September - 4 Oktober 2026
 */
export function rentangTanggal(dari, sampai) {
  if (!dari && !sampai) return 'Semua waktu';
  if (dari && !sampai) return `Mulai ${tanggalPanjang(dari)}`;
  if (!dari && sampai) return `Sampai ${tanggalPanjang(sampai)}`;

  const a = keTanggal(dari);
  const b = keTanggal(sampai);
  if (a.toDateString() === b.toDateString()) return tanggalPanjang(a);

  if (a.getFullYear() === b.getFullYear()) {
    if (a.getMonth() === b.getMonth())
      return `${a.getDate()} - ${b.getDate()} ${NAMA_BULAN[b.getMonth()]} ${b.getFullYear()}`;
    return `${a.getDate()} ${NAMA_BULAN[a.getMonth()]} - ${b.getDate()} ${NAMA_BULAN[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${tanggalPanjang(a)} - ${tanggalPanjang(b)}`;
}

/** Untuk kolom isian tanggal: 2026-10-07 */
export function keIsoTanggal(nilai) {
  const d = keTanggal(nilai || new Date());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 081234567890 -> 0812-3456-7890 */
export function nomorWaTampil(nomor) {
  if (!nomor) return '-';
  const lokal = nomor.startsWith('62') ? '0' + nomor.slice(2) : nomor;
  return lokal.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
}

/** Label metode pembayaran, ditulis utuh tanpa singkatan yang membingungkan. */
export const labelMetode = (m) =>
  ({ qris: 'QRIS', tunai: 'Tunai' })[m] || 'Belum dipilih';

export const labelStatus = (s) =>
  ({
    menunggu_pembayaran: 'Menunggu pembayaran',
    selesai: 'Selesai',
    batal: 'Dibatalkan',
  })[s] || s;

export const labelStatusStruk = (s) =>
  ({
    belum_diisi: 'Belum diisi',
    menunggu_kirim: 'Menunggu dikirim',
    terkirim: 'Sudah terkirim',
    dilewati: 'Dilewati',
  })[s] || s;

/** Nama aksi di log dibuat supaya bisa dibaca orang awam. */
export const labelAksi = (a) =>
  ({
    tambah_produk: 'Menambah produk',
    ubah_produk: 'Mengubah produk',
    arsip_produk: 'Mengarsipkan produk',
    pulihkan_produk: 'Mengembalikan produk dari arsip',
    tambah_menu: 'Menambah menu',
    ubah_menu: 'Mengubah menu',
    arsip_menu: 'Mengarsipkan menu',
    pulihkan_menu: 'Mengembalikan menu dari arsip',
    ubah_diskon: 'Mengubah diskon',
    tambah_stok: 'Menambah stok',
    kurang_stok: 'Mengurangi stok',
    opname: 'Stok opname',
    beri_diskon_transaksi: 'Memberi diskon di kasir',
    konfirmasi_pembayaran: 'Mengonfirmasi pembayaran',
    batal_transaksi: 'Membatalkan transaksi',
    tambah_user: 'Menambah user',
    ubah_user: 'Mengubah user',
    arsip_user: 'Menonaktifkan user',
    pulihkan_user: 'Mengaktifkan user',
    unggah_media: 'Mengunggah bukti bayar',
    hapus_media: 'Menghapus bukti bayar',
    ubah_pengaturan: 'Mengubah pengaturan',
  })[a] || a;
