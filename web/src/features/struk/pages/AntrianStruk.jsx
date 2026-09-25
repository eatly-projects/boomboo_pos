import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LuSend, LuCheck, LuInbox, LuMessageCircle, LuRefreshCw, LuSearch, LuX,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { rupiah, tanggalJam, nomorWaTampil } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { KepalaHalaman, Kosong, Rangka, Pemberitahuan } from '@/shared/components/ui/tampilan';

export default function AntrianStruk() {
  const klien = useQueryClient();
  const [sedangProses, setSedangProses] = useState(null);
  const [cari, setCari] = useState('');

  // Ketikan ditahan sebentar supaya tidak memanggil server tiap huruf.
  const [kataCari, setKataCari] = useState('');
  useEffect(() => {
    const jeda = setTimeout(() => setKataCari(cari.trim()), 350);
    return () => clearTimeout(jeda);
  }, [cari]);

  const data = useQuery({
    queryKey: ['antrian-struk', kataCari],
    queryFn: () => ambil('/struk/antrian', { params: kataCari ? { cari: kataCari } : {} }),
    refetchInterval: 20000,
    placeholderData: (sebelumnya) => sebelumnya,
  });

  const daftar = data.data?.daftar || [];
  const totalAntrian = data.data?.halaman?.total ?? 0;

  async function tandaiTerkirim(id) {
    setSedangProses(id);
    try {
      await denganToast(() => api.post(`/struk/${id}/tandai-terkirim`), {
        memuat: 'Menandai...',
        sukses: 'Struk ditandai sudah terkirim.',
      });
      klien.invalidateQueries({ queryKey: ['antrian-struk'] });
    } catch {
      // toast sudah muncul
    } finally {
      setSedangProses(null);
    }
  }

  return (
    <div>
      <KepalaHalaman
        judul="Antrian Kirim Struk"
        keterangan="Struk yang sudah punya nomor WhatsApp tapi belum dikirim ke pembeli."
        aksi={
          <Button variant="garis" onClick={() => data.refetch()} disabled={data.isFetching}>
            <LuRefreshCw className={data.isFetching ? 'animate-spin' : undefined} />
            Muat ulang
          </Button>
        }
      />

      <Pemberitahuan warna="netral" className="mb-4" ikon={LuMessageCircle} judul="Cara pakainya">
        Buka halaman ini di <strong>satu HP yang sudah login nomor WhatsApp resmi Boomboo</strong>,
        supaya semua pesan keluar dari nomor yang sama. Tekan <strong>Kirim</strong>, WhatsApp akan
        terbuka dengan pesan sudah terisi lengkap, Anda tinggal menekan tombol kirim di WhatsApp.
        Setelah itu kembali ke sini dan tekan <strong>Sudah dikirim</strong>.
      </Pemberitahuan>

      {/* Pencarian */}
      <div className="relative mb-4">
        <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
        <Input
          placeholder="Cari nama pembeli, nomor telepon, atau nomor transaksi..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          className="pl-10 pr-10"
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

      {data.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Rangka key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong
          ikon={kataCari ? LuSearch : LuInbox}
          judul={kataCari ? 'Tidak ada yang cocok' : 'Antrian kosong'}
          keterangan={
            kataCari
              ? `Tidak ditemukan struk dengan kata "${kataCari}". Coba nama lain, atau ketik nomor teleponnya.`
              : 'Semua struk sudah dikirim. Kerja bagus!'
          }
          aksi={
            kataCari && (
              <Button variant="garis" onClick={() => setCari('')}>
                Tampilkan semua antrian
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-coklat-400">
            {kataCari ? (
              <>
                Ketemu <span className="angka font-bold text-coklat-900">{totalAntrian}</span> struk
                untuk kata &ldquo;{kataCari}&rdquo;
              </>
            ) : (
              <>
                <span className="angka font-bold text-coklat-900">{totalAntrian}</span> struk
                menunggu dikirim, mulai dari yang paling baru
              </>
            )}
          </p>

          <div className="space-y-2">
            {daftar.map((s) => (
              <div key={s.id} className="rounded-2xl border-2 border-netral-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-coklat-900">
                      {s.nama_pembeli || 'Tanpa nama'}
                    </p>
                    <p className="angka text-sm text-coklat-600">{nomorWaTampil(s.nomor_wa)}</p>
                    <p className="angka mt-1 text-xs text-coklat-400">
                      {s.nomor} &middot; {rupiah(s.total)} &middot; {tanggalJam(s.dikonfirmasi_pada)}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <Button variant="hijau" ukuran="kecil" asChild>
                      <a href={s.link_whatsapp} target="_blank" rel="noreferrer">
                        <LuSend /> Kirim
                      </a>
                    </Button>
                    <Button
                      variant="garis"
                      ukuran="kecil"
                      onClick={() => tandaiTerkirim(s.id)}
                      disabled={sedangProses === s.id}
                    >
                      <LuCheck /> Sudah dikirim
                    </Button>
                  </div>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-coklat-400 hover:text-coklat-900">
                    Lihat isi pesannya
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-coklat-50 p-3 text-xs text-coklat-900">
                    {s.pesan}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
