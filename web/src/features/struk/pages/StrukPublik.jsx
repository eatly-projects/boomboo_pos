import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LuTriangleAlert, LuCheck } from 'react-icons/lu';
import { ambil } from '@/shared/lib/api';
import { rupiah, tanggalLengkap, jam, labelMetode } from '@/shared/lib/format';
import LogoBoomboo, { HiasanBoomboo } from '@/shared/components/LogoBoomboo.jsx';
import { Rangka } from '@/shared/components/ui/tampilan';

/**
 * Halaman struk yang dibuka pembeli lewat link WhatsApp.
 *
 * Ini satu-satunya halaman yang dilihat orang luar, jadi di sinilah
 * identitas merek tampil penuh: logo lengkap, Boom Red, Seed Yellow,
 * bingkai belah ketupat, ikon cabai, dan watermark.
 *
 * Tetap mengikuti aturan brand book: tidak ada warna hitam sama sekali,
 * teks memakai cokelat tua, dan kombinasi warnanya dijaga tidak lebih dari
 * tiga warna utama.
 */
export default function StrukPublik() {
  const { kode } = useParams();
  const data = useQuery({
    queryKey: ['struk', kode],
    queryFn: () => ambil(`/struk/publik/${kode}`),
    retry: false,
  });

  if (data.isLoading) {
    return (
      <div className="min-h-dvh bg-biji-50 px-4 py-8">
        <div className="mx-auto w-full max-w-md space-y-3">
          <Rangka className="mx-auto h-12 w-48" />
          <Rangka className="h-96 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (data.isError || !data.data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-biji-50 px-6">
        <div className="w-full max-w-sm rounded-3xl border-2 border-netral-200 bg-white p-8 text-center">
          <LuTriangleAlert className="mx-auto size-10 text-boom-500" />
          <p className="mt-3 text-lg font-extrabold text-coklat-900">Struk tidak ditemukan</p>
          <p className="mt-1.5 text-sm text-coklat-400">
            Linknya mungkin salah ketik atau sudah tidak berlaku. Silakan hubungi kasir Boomboo.
          </p>
          <LogoBoomboo className="mx-auto mt-6 h-7" />
        </div>
      </div>
    );
  }

  const t = data.data;
  const waktu = t.dikonfirmasi_pada || t.dibuat_pada;

  return (
    <div className="min-h-dvh bg-biji-50 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        {/* ------------------------------------------------------------ */}
        {/* Kartu struk                                                   */}
        {/* ------------------------------------------------------------ */}
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-[0_12px_40px_-12px_rgba(61,31,18,0.25)]">
          {/* Watermark - logo besar samar di belakang isi struk */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
          >
            <img
              src="/merek/logo-utama-merah.svg"
              alt=""
              className="w-[160%] max-w-none -rotate-12 opacity-[0.045]"
            />
          </div>

          {/* Kepala merah */}
          <div className="relative bg-boom-500 px-6 pb-7 pt-6 text-center">
            <div className="pita-ketupat absolute inset-x-0 top-0 h-3 text-white opacity-50" />
            <LogoBoomboo jenis="lengkap" warna="putih" className="mx-auto h-16 sm:h-20" />
            <p className="sempit mt-3 text-sm uppercase tracking-[0.2em] text-white/80">
              Struk Pembelian
            </p>
          </div>

          {/* Lekukan kertas struk */}
          <div className="relative -mt-3 flex justify-between px-2">
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className="size-5 rounded-full bg-biji-50" />
            ))}
          </div>

          <div className="relative px-5 pb-6 pt-2 sm:px-7">
            {/* Ucapan terima kasih */}
            <div className="border-b-2 border-dashed border-netral-200 pb-5 pt-3 text-center">
              <p className="judul text-xl text-coklat-900 sm:text-2xl">
                {t.nama_pembeli ? `Terima kasih, ${t.nama_pembeli}!` : 'Terima kasih, Kak!'}
              </p>
              <p className="mt-1.5 text-sm text-coklat-400">
                Pembayaran Anda sudah kami terima.
              </p>
              <HiasanBoomboo className="mt-4 justify-center" />
            </div>

            {/* Keterangan transaksi */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b-2 border-dashed border-netral-200 py-5 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-coklat-400">Nomor struk</p>
                <p className="angka font-bold text-coklat-900">{t.nomor}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-coklat-400">Cara bayar</p>
                <p className="font-bold text-coklat-900">{labelMetode(t.metode_bayar)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-coklat-400">Tanggal</p>
                <p className="font-bold text-coklat-900">{tanggalLengkap(waktu)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-coklat-400">Jam</p>
                <p className="angka font-bold text-coklat-900">{jam(waktu)} WIB</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wide text-coklat-400">Dilayani oleh</p>
                <p className="font-bold text-coklat-900">{t.nama_kasir}</p>
              </div>
            </div>

            {/* Daftar belanja */}
            <div className="border-b-2 border-dashed border-netral-200 py-5">
              <p className="sempit mb-3 text-sm font-bold uppercase tracking-[0.15em] text-coklat-400">
                Rincian Belanja
              </p>

              <div className="space-y-3.5">
                {t.item.map((i, idx) => (
                  <div key={idx} className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold leading-snug text-coklat-900">{i.nama_barang}</p>
                      <p className="angka mt-0.5 text-sm text-coklat-400">
                        {i.jumlah} x {rupiah(i.harga_dipakai)}
                      </p>
                      {i.harga_diskon != null && (
                        <span className="mt-1 inline-block rounded-md bg-daun-50 px-2 py-0.5 text-xs font-bold text-daun-700">
                          {i.nama_diskon}
                        </span>
                      )}
                    </div>
                    <p className="angka shrink-0 font-bold text-coklat-900">
                      {rupiah(i.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="space-y-2 py-5">
              <div className="flex justify-between text-sm">
                <span className="text-coklat-400">Subtotal</span>
                <span className="angka font-semibold text-coklat-900">{rupiah(t.subtotal)}</span>
              </div>

              {t.diskon_rupiah > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-daun-700">
                    Diskon {t.diskon_jenis === 'persen' ? `${t.diskon_nilai}%` : ''}
                  </span>
                  <span className="angka font-semibold text-daun-700">
                    - {rupiah(t.diskon_rupiah)}
                  </span>
                </div>
              )}

              <div className="mt-3 flex items-end justify-between rounded-2xl bg-boom-500 px-4 py-3.5 text-white">
                <span className="sempit text-sm font-bold uppercase tracking-[0.15em]">
                  Total Bayar
                </span>
                <span className="angka text-2xl font-extrabold">{rupiah(t.total)}</span>
              </div>

              {t.metode_bayar === 'tunai' && (
                <div className="mt-3 space-y-1.5 rounded-2xl bg-coklat-50 px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-coklat-400">Uang diterima</span>
                    <span className="angka font-semibold text-coklat-900">
                      {rupiah(t.uang_diterima)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-coklat-400">Kembalian</span>
                    <span className="angka font-semibold text-coklat-900">
                      {rupiah(t.kembalian)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Tanda lunas */}
            <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-daun-300 bg-daun-50 py-3">
              <LuCheck className="size-5 text-daun-700" />
              <span className="sempit text-base font-bold uppercase tracking-[0.2em] text-daun-700">
                Lunas
              </span>
            </div>

            {/* Penutup */}
            <div className="pt-6 text-center">
              <p className="judul text-lg text-boom-500">Gurih, nagih.</p>
              <p className="mt-1 text-sm text-coklat-400">
                {t.pengaturan?.teks_struk_bawah ||
                  'Terima kasih sudah belanja di Boomboo!'}
              </p>
            </div>
          </div>

          <div className="pita-ketupat relative h-3 text-boom-500 opacity-70" />
        </div>

        {/* Catatan kecil di luar kartu */}
        <p className="mt-5 text-center text-xs leading-relaxed text-coklat-400">
          Struk ini dibuat otomatis oleh sistem kasir Boomboo dan sah tanpa tanda tangan.
          <br />
          Simpan linknya kalau sewaktu-waktu Anda butuh buktinya lagi.
        </p>
      </div>
    </div>
  );
}
