import { buatLayananKatalog } from '../../shared/katalog/katalog.service.js';

/**
 * Menu = paket menu makan. TIDAK punya stok sama sekali, dan menjual Menu
 * tidak memotong stok Produk apa pun (keputusan K1). Bahan bakunya memang
 * sengaja tidak dihitung.
 */
const layanan = buatLayananKatalog({
  tabel: 'menu',
  entitas: 'menu',
  punyaStok: false,
});

export const { daftar, ambil, ambilMentah, tambah, ubah, arsipkan, pulihkan, simpanFoto } =
  layanan;
