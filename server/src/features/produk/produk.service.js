import { buatLayananKatalog } from '../../shared/katalog/katalog.service.js';

/**
 * Produk = barang yang punya fisik dan stoknya bisa bertambah/berkurang.
 *
 * Stok TIDAK diisi di sini. Produk baru selalu mulai dari 0, lalu diisi
 * lewat fitur Stok. Ini sengaja dipisah supaya aturan stok berdiri sendiri
 * dan bisa dijaga ketat.
 *
 * Saklar `dijual_satuan` menentukan apakah produk muncul di layar kasir.
 * Kalau mati, stoknya tetap dicatat tapi barangnya hanya dipakai sebagai
 * penyusun menu - contohnya mie instan yang tidak dijual sendiri.
 */
const layanan = buatLayananKatalog({
  tabel: 'produk',
  entitas: 'produk',
  punyaStok: true,
  punyaKomponen: false,
});

export const { daftar, ambil, ambilMentah, tambah, ubah, arsipkan, pulihkan } = layanan;
