import { cn } from '@/shared/lib/utils';

/**
 * Logo Boomboo, diambil langsung dari berkas brand book resmi.
 *
 * Aturan dari brand book yang dipatuhi di sini:
 *  - Logo utama SELALU berwarna Boom Red. Versi putih hanya dipakai di atas
 *    latar berwarna gelap atau merah.
 *  - Bentuknya tidak boleh diubah, dimiringkan, atau diberi efek bayangan.
 *    Karena itu komponen ini hanya mengatur tinggi, tidak pernah lebarnya.
 *  - Monogram tidak boleh berdiri sendiri, jadi hanya dipakai sebagai ikon
 *    kecil di tab peramban.
 */
export default function LogoBoomboo({
  jenis = 'utama', // 'utama' | 'lengkap'
  warna = 'merah', // 'merah' | 'putih'
  className,
}) {
  return (
    <img
      src={`/merek/logo-${jenis}-${warna}.svg`}
      alt="Boomboo"
      draggable={false}
      className={cn('h-8 w-auto shrink-0 select-none self-start', className)}
    />
  );
}

/** Ikon cabai rawit - boleh berdiri sendiri (brand book halaman 27). */
export function IkonCabai({ warna = 'merah', className }) {
  return (
    <img
      src={`/merek/ikon-cabai-${warna}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('h-6 w-auto shrink-0 select-none self-start', className)}
    />
  );
}

/** Daun jeruk dan percikan HANYA boleh tampil bersama cabai. */
export function HiasanBoomboo({ warna = 'merah', className }) {
  return (
    <div className={cn('flex items-end gap-2', className)} aria-hidden="true">
      <img src={`/merek/ikon-percikan-${warna}.svg`} alt="" className="h-5 w-auto opacity-80" />
      <img src={`/merek/ikon-cabai-${warna}.svg`} alt="" className="h-8 w-auto" />
      <img src={`/merek/ikon-daun-jeruk-${warna}.svg`} alt="" className="h-6 w-auto opacity-90" />
    </div>
  );
}
