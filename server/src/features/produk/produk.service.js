import { buatLayananKatalog } from '../../shared/katalog/katalog.service.js';

/**
 * Produk = barang yang punya fisik dan stoknya bisa bertambah/berkurang.
 * Stok TIDAK diisi di sini. Produk baru selalu mulai dari 0, lalu diisi
 * lewat fitur Stok. Ini sengaja dipisah supaya aturan stok berdiri sendiri
 * dan bisa dijaga ketat.
 */
const layanan = buatLayananKatalog({
  tabel: 'produk',
  entitas: 'produk',
  punyaStok: true,
});

export const { daftar, ambil, ambilMentah, tambah, ubah, arsipkan, pulihkan, simpanFoto } =
  layanan;
