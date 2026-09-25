import HalamanKatalog from '@/shared/components/HalamanKatalog.jsx';

export default function HalamanMenu() {
  return (
    <HalamanKatalog
      jalur="/menu"
      label="Menu"
      labelJamak="Menu Makan"
      keterangan="Paket makanan dan minuman yang dimasak di tempat. Tidak punya stok, dan menjualnya tidak mengurangi stok produk apa pun."
      punyaStok={false}
    />
  );
}
