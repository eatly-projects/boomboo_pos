import { useState } from 'react';
import { LuMinus, LuPlus, LuTrash2, LuShoppingCart, LuTicketPercent, LuArrowRight } from 'react-icons/lu';
import { useKeranjang, useHitunganKeranjang } from '../kasir.store';
import { rupiah } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, InputRupiah } from '@/shared/components/ui/input';
import { Kosong } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

function BarisItem({ item, setJumlah, hapus }) {
  const mentok = item.jenis_barang === 'produk' && item.jumlah >= item.stok;

  return (
    <div className="flex gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug text-coklat-900">{item.nama}</p>
        <p className="angka mt-0.5 text-xs text-coklat-400">
          {rupiah(item.harga_dipakai)} per buah
          {item.harga_diskon != null && (
            <span className="ml-1.5 rounded bg-daun-50 px-1.5 py-0.5 font-semibold text-daun-700">
              {item.nama_diskon}
            </span>
          )}
        </p>

        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Kurangi"
            onClick={() => setJumlah(item.kunci, item.jumlah - 1)}
            className="grid size-8 place-items-center rounded-lg border-2 border-netral-200 text-coklat-600 transition-colors hover:border-boom-500 hover:text-boom-600"
          >
            <LuMinus className="size-3.5" />
          </button>

          <span className="angka w-9 text-center text-sm font-bold text-coklat-900">
            {item.jumlah}
          </span>

          <button
            type="button"
            aria-label="Tambah"
            disabled={mentok}
            onClick={() => setJumlah(item.kunci, item.jumlah + 1)}
            className="grid size-8 place-items-center rounded-lg border-2 border-netral-200 text-coklat-600 transition-colors hover:border-boom-500 hover:text-boom-600 disabled:opacity-40 disabled:hover:border-netral-200"
          >
            <LuPlus className="size-3.5" />
          </button>

          <button
            type="button"
            aria-label="Hapus dari keranjang"
            onClick={() => hapus(item.kunci)}
            className="ml-1 grid size-8 place-items-center rounded-lg text-coklat-400 transition-colors hover:bg-boom-50 hover:text-boom-600"
          >
            <LuTrash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <p className="angka shrink-0 text-sm font-extrabold text-coklat-900">
        {rupiah(item.harga_dipakai * item.jumlah)}
      </p>
    </div>
  );
}

function KotakDiskon() {
  const { diskon_jenis, diskon_nilai, setDiskon } = useKeranjang();
  const [terbuka, setTerbuka] = useState(Boolean(diskon_nilai));

  if (!terbuka) {
    return (
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-netral-300 py-2.5 text-sm font-semibold text-coklat-600 transition-colors hover:border-boom-500 hover:text-boom-600"
      >
        <LuTicketPercent className="size-4" />
        Beri diskon
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-netral-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-coklat-900">Diskon transaksi</p>
        <button
          type="button"
          onClick={() => {
            setDiskon(null, null);
            setTerbuka(false);
          }}
          className="text-xs font-semibold text-coklat-400 hover:text-boom-600"
        >
          Hapus diskon
        </button>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1.5 rounded-lg bg-netral-100 p-1">
        {[
          { nilai: 'persen', label: 'Persen (%)' },
          { nilai: 'nominal', label: 'Potongan (Rp)' },
        ].map((p) => (
          <button
            key={p.nilai}
            type="button"
            onClick={() => setDiskon(p.nilai, diskon_nilai)}
            className={cn(
              'rounded-md py-1.5 text-xs font-bold transition-colors',
              diskon_jenis === p.nilai
                ? 'bg-white text-coklat-900 shadow-sm'
                : 'text-coklat-400 hover:text-coklat-900'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {diskon_jenis === 'persen' ? (
        <div className="relative">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            placeholder="Contoh: 10"
            value={diskon_nilai ?? ''}
            onChange={(e) =>
              setDiskon('persen', e.target.value === '' ? null : Number(e.target.value))
            }
            className="angka h-10 pr-8"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-coklat-400">
            %
          </span>
        </div>
      ) : (
        <InputRupiah
          placeholder="Contoh: 15000"
          value={diskon_nilai ?? ''}
          onChange={(n) => setDiskon('nominal', n === '' ? null : n)}
          className="h-10"
        />
      )}
      <p className="mt-1.5 text-xs text-coklat-400">
        Diskon ini tercatat di log beserta nama Anda.
      </p>
    </div>
  );
}

export default function PanelKeranjang({ onLanjut, sedangKirim, className }) {
  const { item, setJumlah, hapus, kosongkan } = useKeranjang();
  const { subtotal, potongan, total, jumlahBarang } = useHitunganKeranjang();

  return (
    <div className={cn('flex h-full flex-col bg-white', className)}>
      <div className="flex shrink-0 items-center justify-between border-b-2 border-netral-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <LuShoppingCart className="size-4.5 text-coklat-600" />
          <p className="font-bold text-coklat-900">Keranjang</p>
          {jumlahBarang > 0 && (
            <span className="angka rounded-lg bg-boom-500 px-2 py-0.5 text-xs font-bold text-white">
              {jumlahBarang}
            </span>
          )}
        </div>
        {item.length > 0 && (
          <button
            type="button"
            onClick={kosongkan}
            className="text-xs font-semibold text-coklat-400 hover:text-boom-600"
          >
            Kosongkan
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {item.length === 0 ? (
          <Kosong
            ikon={LuShoppingCart}
            judul="Keranjang masih kosong"
            keterangan="Pilih produk atau menu di sebelah kiri untuk mulai melayani pembeli."
          />
        ) : (
          <div className="divide-y-2 divide-netral-100">
            {item.map((i) => (
              <BarisItem key={i.kunci} item={i} setJumlah={setJumlah} hapus={hapus} />
            ))}
          </div>
        )}
      </div>

      {item.length > 0 && (
        <div className="pb-aman-4 shrink-0 space-y-3 border-t-2 border-netral-200 px-4 pt-4">
          <KotakDiskon />

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-coklat-600">
              <span>Subtotal</span>
              <span className="angka font-semibold">{rupiah(subtotal)}</span>
            </div>
            {potongan > 0 && (
              <div className="flex justify-between text-daun-700">
                <span>Diskon</span>
                <span className="angka font-semibold">- {rupiah(potongan)}</span>
              </div>
            )}
            <div className="flex items-end justify-between border-t-2 border-netral-200 pt-2">
              <span className="font-bold text-coklat-900">Total bayar</span>
              <span className="angka text-xl font-extrabold text-boom-600">{rupiah(total)}</span>
            </div>
          </div>

          <Button ukuran="besar" className="w-full" onClick={onLanjut} disabled={sedangKirim}>
            {sedangKirim ? 'Menyiapkan...' : 'Lanjut ke Pembayaran'}
            {!sedangKirim && <LuArrowRight />}
          </Button>
        </div>
      )}
    </div>
  );
}
