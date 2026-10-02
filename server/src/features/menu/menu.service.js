import { buatLayananKatalog } from '../../shared/katalog/katalog.service.js';

/**
 * Menu = paket makanan atau minuman. Tidak punya stok sendiri.
 *
 * Sejak permintaan R6.2, menu BOLEH punya penyusun berupa produk berstok.
 * Contoh: paket berisi 1 mie instan + 1 air mineral. Saat menu itu terjual,
 * stok kedua produk penyusunnya ikut berkurang.
 *
 * Penyusunnya boleh sebagian saja - hanya barang yang stoknya memang dicatat.
 * Nasi dan ayam yang tidak dihitung satuan tidak perlu didaftarkan. Menu tanpa
 * penyusun sama sekali juga tetap boleh, dan tidak menyentuh stok apa pun.
 *
 * Ini membatalkan keputusan lama K1 yang menyatakan Produk dan Menu terpisah
 * total.
 */
const layanan = buatLayananKatalog({
  tabel: 'menu',
  entitas: 'menu',
  punyaStok: false,
  punyaKomponen: true,
});

export const { daftar, ambil, ambilMentah, tambah, ubah, arsipkan, pulihkan } = layanan;
