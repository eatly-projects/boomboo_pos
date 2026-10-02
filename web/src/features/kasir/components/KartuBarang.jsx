import { LuPackage, LuUtensils, LuTriangleAlert } from 'react-icons/lu';
import { rupiah } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

/**
 * Satu tombol barang di layar kasir.
 * Dibuat besar supaya gampang ditekan dengan jempol sambil berdiri.
 *
 * Tidak ada foto barang sama sekali (permintaan R6), cukup ikon. Untuk menu
 * yang punya penyusun berstok, sisa porsinya ikut ditampilkan - dihitung dari
 * penyusun yang paling sedikit, supaya kasir tidak menjual sesuatu yang tidak
 * bisa dibuat (keputusan K37).
 */
export default function KartuBarang({ barang, jenis, jumlahDiKeranjang, onPilih }) {
  const adaDiskon = barang.harga_diskon != null;
  const hargaPakai = barang.harga_diskon ?? barang.harga;
  const produk = jenis === 'produk';

  // Produk dibatasi stoknya sendiri, menu dibatasi penyusunnya
  const sisa = produk ? barang.stok : barang.sisa_porsi;
  const adaBatas = sisa !== null && sisa !== undefined;
  const habis = adaBatas && sisa <= 0;
  const menipis = adaBatas && sisa > 0 && sisa <= 5;

  const Ikon = produk ? LuPackage : LuUtensils;

  return (
    <button
      type="button"
      onClick={() => onPilih(barang, jenis)}
      disabled={habis}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white p-3 text-left transition-all',
        habis
          ? 'cursor-not-allowed border-netral-200 opacity-55'
          : 'border-netral-200 hover:border-boom-500 active:scale-[0.98]',
        jumlahDiKeranjang > 0 && 'border-boom-500 ring-2 ring-boom-100'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            produk ? 'bg-boom-50 text-boom-600' : 'bg-daun-50 text-daun-700'
          )}
        >
          <Ikon className="size-5" />
        </span>

        {jumlahDiKeranjang > 0 && (
          <span className="angka grid size-7 shrink-0 place-items-center rounded-lg bg-boom-500 text-sm font-bold text-white">
            {jumlahDiKeranjang}
          </span>
        )}
      </div>

      <p className="mt-2.5 line-clamp-2 text-sm font-bold leading-snug text-coklat-900">
        {barang.nama}
      </p>

      {adaDiskon && !habis && (
        <span className="mt-1 w-fit rounded-md bg-daun-50 px-1.5 py-0.5 text-xs font-bold text-daun-700">
          {barang.nama_diskon}
        </span>
      )}

      <div className="mt-auto pt-2">
        <p className="angka text-sm font-extrabold text-boom-600">{rupiah(hargaPakai)}</p>
        {adaDiskon && (
          <p className="angka text-xs text-coklat-400 line-through">{rupiah(barang.harga)}</p>
        )}

        {habis ? (
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-boom-600">
            <LuTriangleAlert className="size-3" />
            {produk ? 'Stok habis' : `Bahan habis: ${barang.pembatas_porsi || 'penyusunnya'}`}
          </p>
        ) : adaBatas ? (
          <p
            className={cn(
              'angka mt-1 text-xs font-medium',
              menipis ? 'text-boom-600' : 'text-coklat-400'
            )}
          >
            {produk ? `Sisa stok ${sisa}` : `Sisa ${sisa} porsi`}
          </p>
        ) : (
          <p className="mt-1 text-xs text-coklat-400">Tidak dibatasi stok</p>
        )}
      </div>
    </button>
  );
}
