import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LuSearch, LuShoppingCart, LuPackageOpen, LuX } from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { useKeranjang, useHitunganKeranjang } from '../kasir.store';
import KartuBarang from '../components/KartuBarang.jsx';
import PanelKeranjang from '../components/PanelKeranjang.jsx';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Kosong, Rangka } from '@/shared/components/ui/tampilan';
import { rupiah } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

const SARINGAN = [
  { nilai: 'semua', label: 'Semua' },
  { nilai: 'produk', label: 'Produk' },
  { nilai: 'menu', label: 'Menu Makan' },
];

export default function Kasir() {
  const navigate = useNavigate();
  const [cari, setCari] = useState('');
  const [saringan, setSaringan] = useState('semua');
  const [keranjangTerbuka, setKeranjangTerbuka] = useState(false);
  const [sedangKirim, setSedangKirim] = useState(false);

  const keranjang = useKeranjang();
  const { total, jumlahBarang } = useHitunganKeranjang();

  const produk = useQuery({ queryKey: ['produk'], queryFn: () => ambil('/produk') });
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => ambil('/menu') });

  const sedangMemuat = produk.isLoading || menu.isLoading;

  const barang = useMemo(() => {
    const semua = [
      ...(saringan !== 'menu' ? (produk.data || []).map((p) => ({ ...p, _jenis: 'produk' })) : []),
      ...(saringan !== 'produk' ? (menu.data || []).map((m) => ({ ...m, _jenis: 'menu' })) : []),
    ];
    const kata = cari.trim().toLowerCase();
    return kata ? semua.filter((b) => b.nama.toLowerCase().includes(kata)) : semua;
  }, [produk.data, menu.data, saringan, cari]);

  const jumlahDiKeranjang = (id, jenis) =>
    keranjang.item.find((i) => i.kunci === `${jenis}:${id}`)?.jumlah || 0;

  function pilihBarang(b, jenis) {
    const berhasil = keranjang.tambah(b, jenis);
    if (!berhasil) toast.error(`Stok ${b.nama} tidak mencukupi.`);
  }

  async function lanjutKePembayaran() {
    if (keranjang.item.length === 0) return toast.error('Keranjang masih kosong.');
    setSedangKirim(true);
    try {
      const hasil = await denganToast(
        () => api.post('/transaksi', keranjang.untukDikirim()),
        { memuat: 'Menyiapkan pembayaran...', sukses: (d) => d.pesan }
      );
      setKeranjangTerbuka(false);
      navigate(`/kasir/bayar/${hasil.data.id}`);
    } catch {
      // pesannya sudah muncul lewat toast
    } finally {
      setSedangKirim(false);
    }
  }

  return (
    <div className="lg:-my-6 lg:flex lg:h-[calc(100dvh-3rem)] lg:gap-5">
      {/* Daftar barang */}
      <div className="min-w-0 flex-1 lg:flex lg:flex-col lg:overflow-hidden lg:py-6">
        <div className="mb-4 space-y-3">
          <div className="relative">
            <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
            <Input
              placeholder="Cari nama produk atau menu..."
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="h-12 pl-10 pr-10"
            />
            {cari && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setCari('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-coklat-400 hover:bg-coklat-50"
              >
                <LuX className="size-4" />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 rounded-xl bg-white p-1">
            {SARINGAN.map((s) => (
              <button
                key={s.nilai}
                type="button"
                onClick={() => setSaringan(s.nilai)}
                className={cn(
                  'flex-1 rounded-lg py-2 text-sm font-bold transition-colors',
                  saringan === s.nilai
                    ? 'bg-boom-500 text-white'
                    : 'text-coklat-600 hover:bg-coklat-50'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pb-24 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-2">
          {sedangMemuat ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border-2 border-netral-200">
                  <Rangka className="aspect-4/3 rounded-none" />
                  <div className="space-y-2 p-2.5">
                    <Rangka className="h-4 w-full" />
                    <Rangka className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : barang.length === 0 ? (
            <Kosong
              ikon={LuPackageOpen}
              judul={cari ? 'Tidak ada yang cocok' : 'Belum ada barang'}
              keterangan={
                cari
                  ? `Tidak ditemukan barang dengan kata "${cari}". Coba kata lain.`
                  : 'Tambahkan produk atau menu terlebih dahulu di halaman Katalog.'
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {barang.map((b) => (
                <KartuBarang
                  key={`${b._jenis}:${b.id}`}
                  barang={b}
                  jenis={b._jenis}
                  jumlahDiKeranjang={jumlahDiKeranjang(b.id, b._jenis)}
                  onPilih={pilihBarang}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Keranjang - menempel di kanan pada layar lebar */}
      <aside className="hidden w-[22rem] shrink-0 lg:block xl:w-96">
        <div className="sticky top-6 h-[calc(100dvh-3rem)] overflow-hidden rounded-2xl border-2 border-netral-200">
          <PanelKeranjang onLanjut={lanjutKePembayaran} sedangKirim={sedangKirim} />
        </div>
      </aside>

      {/* Keranjang - bilah bawah pada layar kecil */}
      {jumlahBarang > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-netral-200 bg-white p-3 lg:hidden">
          <Button
            ukuran="besar"
            className="w-full justify-between"
            onClick={() => setKeranjangTerbuka(true)}
          >
            <span className="flex items-center gap-2">
              <LuShoppingCart className="size-5" />
              {jumlahBarang} barang
            </span>
            <span className="angka">{rupiah(total)}</span>
          </Button>
        </div>
      )}

      {keranjangTerbuka && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Tutup keranjang"
            onClick={() => setKeranjangTerbuka(false)}
            className="absolute inset-0 bg-coklat-900/40 backdrop-blur-[2px]"
          />
          <div className="animasi-naik absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl bg-white">
            <PanelKeranjang onLanjut={lanjutKePembayaran} sedangKirim={sedangKirim} />
          </div>
        </div>
      )}
    </div>
  );
}
