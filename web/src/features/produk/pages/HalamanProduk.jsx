import HalamanKatalog from '@/shared/components/HalamanKatalog.jsx';

export default function HalamanProduk() {
  return (
    <HalamanKatalog
      jalur="/produk"
      label="Produk"
      labelJamak="Produk"
      keterangan="Barang yang ada fisiknya dan stoknya dihitung, misalnya botol sambal."
      punyaStok
    />
  );
}
