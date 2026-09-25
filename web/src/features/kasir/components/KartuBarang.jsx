import { LuPackage, LuUtensils } from 'react-icons/lu';
import { rupiah } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

/**
 * Satu tombol barang di layar kasir.
 * Dibuat besar supaya gampang ditekan dengan jempol sambil berdiri.
 */
export default function KartuBarang({ barang, jenis, jumlahDiKeranjang, onPilih }) {
  const adaDiskon = barang.harga_diskon != null;
  const hargaPakai = barang.harga_diskon ?? barang.harga;
  const produk = jenis === 'produk';
  const habis = produk && barang.stok <= 0;
  const menipis = produk && barang.stok > 0 && barang.stok <= 5;

  return (
    <button
      type="button"
      onClick={() => onPilih(barang, jenis)}
      disabled={habis}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all',
        habis
          ? 'cursor-not-allowed border-netral-200 opacity-55'
          : 'border-netral-200 hover:border-boom-500 active:scale-[0.98]',
        jumlahDiKeranjang > 0 && 'border-boom-500 ring-2 ring-boom-100'
      )}
    >
      {/* Gambar barang */}
      <div className="relative aspect-4/3 w-full shrink-0 overflow-hidden bg-coklat-50">
        {barang.foto_url ? (
          <img
            src={barang.foto_url}
            alt={barang.nama}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-coklat-200">
            {produk ? <LuPackage className="size-9" /> : <LuUtensils className="size-9" />}
          </div>
        )}

        {jumlahDiKeranjang > 0 && (
          <span className="angka absolute right-2 top-2 grid size-7 place-items-center rounded-lg bg-boom-500 text-sm font-bold text-white shadow">
            {jumlahDiKeranjang}
          </span>
        )}

        {adaDiskon && !habis && (
          <span className="absolute left-2 top-2 rounded-lg bg-daun-500 px-2 py-0.5 text-xs font-bold text-white">
            {barang.nama_diskon}
          </span>
        )}

        {habis && (
          <span className="absolute inset-x-0 bottom-0 bg-coklat-900/80 py-1 text-center text-xs font-bold text-white">
            Stok habis
          </span>
        )}
      </div>

      {/* Keterangan */}
      <div className="flex min-w-0 flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-coklat-900">
          {barang.nama}
        </p>

        <div className="mt-auto pt-1.5">
          <p className="angka text-sm font-extrabold text-boom-600">{rupiah(hargaPakai)}</p>
          {adaDiskon && (
            <p className="angka text-xs text-coklat-400 line-through">{rupiah(barang.harga)}</p>
          )}
          {produk && !habis && (
            <p
              className={cn(
                'angka mt-0.5 text-xs font-medium',
                menipis ? 'text-boom-600' : 'text-coklat-400'
              )}
            >
              Sisa stok {barang.stok}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
