import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

/* ---------------------------------------------------------------- */
/* Label status                                                      */
/* ---------------------------------------------------------------- */
const gayaLabel = cva(
  'inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      warna: {
        netral: 'bg-netral-100 text-coklat-600',
        merah: 'bg-boom-50 text-boom-700',
        hijau: 'bg-daun-50 text-daun-700',
        kuning: 'bg-biji-100 text-coklat-900',
        biru: 'bg-blue-50 text-biru-500',
      },
    },
    defaultVariants: { warna: 'netral' },
  }
);

export function Label({ warna, className, children, ...props }) {
  return (
    <span className={cn(gayaLabel({ warna }), className)} {...props}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Rangka pemuatan                                                   */
/* ---------------------------------------------------------------- */

/** Saat data sedang dimuat, layar TIDAK boleh kosong atau bertulisan
 *  "tidak ada data". Yang muncul adalah rangka abu-abu berdenyut. */
export function Rangka({ className }) {
  return <div className={cn('animate-pulse rounded-lg bg-netral-200', className)} />;
}

export function RangkaKartu({ jumlah = 3 }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="rounded-2xl border-2 border-netral-200 p-4">
          <Rangka className="h-4 w-2/3" />
          <Rangka className="mt-3 h-7 w-1/2" />
          <Rangka className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function RangkaBaris({ jumlah = 6, tinggi = 'h-14' }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: jumlah }).map((_, i) => (
        <Rangka key={i} className={cn('w-full', tinggi)} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Keadaan kosong                                                    */
/* ---------------------------------------------------------------- */
export function Kosong({ ikon: Ikon, judul, keterangan, aksi, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Ikon && (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-coklat-50 text-coklat-400">
          <Ikon className="size-7" />
        </div>
      )}
      <p className="font-bold text-coklat-900">{judul}</p>
      {keterangan && <p className="mt-1 max-w-sm text-sm text-coklat-400">{keterangan}</p>}
      {aksi && <div className="mt-5">{aksi}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Kepala halaman                                                    */
/* ---------------------------------------------------------------- */
export function KepalaHalaman({ judul, keterangan, aksi }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-coklat-900 sm:text-2xl">
          {judul}
        </h1>
        {keterangan && <p className="mt-0.5 text-sm text-coklat-400">{keterangan}</p>}
      </div>
      {aksi && <div className="flex shrink-0 flex-wrap gap-2">{aksi}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Kotak angka penting                                               */
/* ---------------------------------------------------------------- */
export function KotakAngka({ judul, nilai, keterangan, ikon: Ikon, warna = 'netral', className }) {
  const warnaIkon = {
    netral: 'bg-coklat-50 text-coklat-600',
    merah: 'bg-boom-50 text-boom-600',
    hijau: 'bg-daun-50 text-daun-700',
    kuning: 'bg-biji-100 text-coklat-900',
  }[warna];

  return (
    <div className={cn('rounded-2xl border-2 border-netral-200 bg-white p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-coklat-400">{judul}</p>
        {Ikon && (
          <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl', warnaIkon)}>
            <Ikon className="size-4.5" />
          </div>
        )}
      </div>
      <p className="angka mt-2 text-2xl font-extrabold tracking-tight text-coklat-900">{nilai}</p>
      {keterangan && <p className="mt-1 text-xs text-coklat-400">{keterangan}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Pemberitahuan di dalam halaman                                    */
/* ---------------------------------------------------------------- */
export function Pemberitahuan({ warna = 'kuning', ikon: Ikon, judul, children, className }) {
  const gaya = {
    kuning: 'border-biji-500 bg-biji-50',
    merah: 'border-boom-200 bg-boom-50',
    hijau: 'border-daun-300 bg-daun-50',
    netral: 'border-netral-300 bg-netral-100',
  }[warna];

  return (
    <div className={cn('flex gap-3 rounded-xl border-2 p-3.5', gaya, className)}>
      {Ikon && <Ikon className="mt-0.5 size-5 shrink-0 text-coklat-600" />}
      <div className="min-w-0 text-sm text-coklat-900">
        {judul && <p className="font-bold">{judul}</p>}
        {children && <div className={cn(judul && 'mt-0.5', 'text-coklat-600')}>{children}</div>}
      </div>
    </div>
  );
}
