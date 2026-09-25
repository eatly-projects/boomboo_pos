import LogoBoomboo, { HiasanBoomboo } from '@/shared/components/LogoBoomboo.jsx';

/**
 * Bingkai untuk halaman Masuk dan Daftar.
 * Ini satu-satunya bagian aplikasi dalam yang tampil penuh warna merek,
 * karena belum ada angka yang perlu dibaca cepat di sini.
 */
export default function BingkaiAuth({ judul, keterangan, children, bawah }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Panel merek - hanya muncul di layar lebar */}
      <div className="relative hidden overflow-hidden bg-boom-500 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="pita-ketupat absolute inset-x-0 top-0 h-4 text-white opacity-40" />

        <LogoBoomboo warna="putih" className="relative h-10 self-start" />

        <div className="relative">
          <p className="judul text-4xl leading-tight text-white xl:text-5xl">
            Gurih, nagih.
          </p>
          <p className="mt-3 max-w-sm text-lg text-white/80">
            Terbuat dari bahan segar. Sekarang kasirnya ikut rapi juga.
          </p>
          <HiasanBoomboo warna="putih" className="mt-8 opacity-90" />
        </div>

        <p className="relative text-sm text-white/60">
          Aplikasi kasir internal Boomboo
        </p>

        <div className="pita-ketupat absolute inset-x-0 bottom-0 h-4 text-white opacity-40" />
      </div>

      {/* Panel isian */}
      <div className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10 lg:min-h-0">
        <div className="mx-auto w-full max-w-sm">
          <LogoBoomboo className="mb-8 h-9 lg:hidden" />

          <h1 className="text-2xl font-extrabold tracking-tight text-coklat-900">{judul}</h1>
          {keterangan && <p className="mt-1.5 text-sm text-coklat-400">{keterangan}</p>}

          <div className="mt-7">{children}</div>

          {bawah && <div className="mt-6 text-center text-sm text-coklat-400">{bawah}</div>}
        </div>
      </div>
    </div>
  );
}
