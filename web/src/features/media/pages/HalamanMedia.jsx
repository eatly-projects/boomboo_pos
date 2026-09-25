import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LuUpload, LuImage, LuTrash2, LuX, LuInfo, LuSearch } from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { tanggalJam, tanggalPanjang, keIsoTanggal } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, Kolom } from '@/shared/components/ui/input';
import { Pilihan } from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';
import { KepalaHalaman, Kosong, Rangka, Pemberitahuan } from '@/shared/components/ui/tampilan';

export default function HalamanMedia() {
  const klien = useQueryClient();
  const [saring, setSaring] = useState({
    cari: '',
    nama_pengunggah: 'semua',
    tanggal_dari: '',
    tanggal_sampai: '',
  });
  const [catatan, setCatatan] = useState('');
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [dilihat, setDilihat] = useState(null);

  const params = {
    per_halaman: 100,
    ...(saring.cari ? { cari: saring.cari } : {}),
    ...(saring.nama_pengunggah !== 'semua' ? { nama_pengunggah: saring.nama_pengunggah } : {}),
    ...(saring.tanggal_dari ? { tanggal_dari: saring.tanggal_dari } : {}),
    ...(saring.tanggal_sampai ? { tanggal_sampai: saring.tanggal_sampai } : {}),
  };

  const data = useQuery({
    queryKey: ['media', params],
    queryFn: () => ambil('/media', { params }),
  });

  const pengunggah = useQuery({
    queryKey: ['media-pengunggah'],
    queryFn: () => ambil('/media/pengunggah'),
  });

  const daftar = data.data?.daftar || [];
  const daftarPengunggah = pengunggah.data || [];

  async function unggah(e) {
    const berkas = [...(e.target.files || [])];
    if (!berkas.length) return;

    const isi = new FormData();
    berkas.forEach((b) => isi.append('berkas', b));
    if (catatan.trim()) isi.append('catatan', catatan.trim());

    setSedangUnggah(true);
    try {
      await denganToast(() => api.post('/media', isi), {
        memuat: `Mengunggah ${berkas.length} berkas...`,
        sukses: (d) => d.pesan,
      });
      klien.invalidateQueries({ queryKey: ['media'] });
      klien.invalidateQueries({ queryKey: ['media-pengunggah'] });
      setCatatan('');
    } catch {
      // toast sudah muncul
    } finally {
      setSedangUnggah(false);
      e.target.value = '';
    }
  }

  async function hapus(m) {
    try {
      await denganToast(() => api.delete(`/media/${m.id}`), {
        memuat: 'Menghapus...',
        sukses: 'Berkas dihapus.',
      });
      klien.invalidateQueries({ queryKey: ['media'] });
      klien.invalidateQueries({ queryKey: ['media-pengunggah'] });
      setDilihat(null);
    } catch {
      // toast sudah muncul
    }
  }

  return (
    <div>
      <KepalaHalaman
        judul="Media Bukti Bayar"
        keterangan="Tempat menyimpan foto bukti pembayaran QRIS. Diunggah belakangan, tidak mengganggu antrian kasir."
      />

      <Pemberitahuan warna="netral" className="mb-4" ikon={LuInfo} judul="Cara kerjanya">
        Bagian ini sengaja <strong>berdiri sendiri</strong>, berkasnya tidak menempel ke transaksi
        tertentu. Supaya tetap bisa ditelusuri kalau ada selisih uang, setiap berkas otomatis
        mencatat <strong>tanggal, jam, dan nama pengunggahnya</strong>.
      </Pemberitahuan>

      {/* Kotak unggah */}
      <div className="mb-4 rounded-2xl border-2 border-netral-200 bg-white p-4">
        <Kolom
          label="Catatan (opsional)"
          bantuan="Contoh: Bukti bayar QRIS hari Sabtu shift pagi."
          className="mb-3"
        >
          <Input
            placeholder="Tulis catatan untuk berkas yang akan diunggah"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </Kolom>

        <label
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-netral-300 px-6 py-8 text-center transition-colors hover:border-boom-500 ${
            sedangUnggah ? 'pointer-events-none animate-pulse' : ''
          }`}
        >
          <LuUpload className="size-8 text-coklat-400" />
          <p className="font-bold text-coklat-900">
            {sedangUnggah ? 'Sedang mengunggah...' : 'Pilih foto bukti bayar'}
          </p>
          <p className="text-sm text-coklat-400">
            Bisa pilih banyak sekaligus. Maksimal 8 MB per gambar.
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={unggah}
            disabled={sedangUnggah}
          />
        </label>
      </div>

      {/* Ringkasan siapa saja yang pernah mengunggah */}
      {daftarPengunggah.length > 0 && (
        <div className="mb-4 rounded-2xl border-2 border-netral-200 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-coklat-900">Siapa saja yang sudah mengunggah</p>
          <div className="flex flex-wrap gap-2">
            {daftarPengunggah.map((p) => {
              const aktif = saring.nama_pengunggah === p.nama_pengunggah;
              return (
                <button
                  key={p.nama_pengunggah}
                  type="button"
                  onClick={() =>
                    setSaring((s) => ({
                      ...s,
                      nama_pengunggah: aktif ? 'semua' : p.nama_pengunggah,
                    }))
                  }
                  className={cn(
                    'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-colors',
                    aktif
                      ? 'border-boom-500 bg-boom-50'
                      : 'border-netral-200 hover:border-coklat-200'
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-boom-500 text-xs font-bold text-white">
                    {p.nama_pengunggah.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-coklat-900">
                      {p.nama_pengunggah}
                    </span>
                    <span className="angka block text-xs text-coklat-400">
                      {p.jumlah_berkas} berkas &middot; terakhir {tanggalPanjang(p.terakhir_pada)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {saring.nama_pengunggah !== 'semua' && (
            <button
              type="button"
              onClick={() => setSaring((s) => ({ ...s, nama_pengunggah: 'semua' }))}
              className="mt-3 text-xs font-bold text-boom-600 hover:underline"
            >
              Tampilkan kembali semua orang
            </button>
          )}
        </div>
      )}

      {/* Penyaring */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-1">
          <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
          <Input
            placeholder="Cari nama berkas, catatan, atau pengunggah..."
            value={saring.cari}
            onChange={(e) => setSaring((s) => ({ ...s, cari: e.target.value }))}
            className="pl-10"
          />
        </div>
        <Pilihan
          nilai={saring.nama_pengunggah}
          onUbah={(v) => setSaring((s) => ({ ...s, nama_pengunggah: v }))}
          placeholder="Diunggah oleh"
          daftar={[
            { nilai: 'semua', label: 'Diunggah oleh siapa saja' },
            ...daftarPengunggah.map((p) => ({
              nilai: p.nama_pengunggah,
              label: `${p.nama_pengunggah} (${p.jumlah_berkas})`,
            })),
          ]}
        />
        <Input
          type="date"
          max={keIsoTanggal(new Date())}
          value={saring.tanggal_dari}
          onChange={(e) => setSaring((s) => ({ ...s, tanggal_dari: e.target.value }))}
        />
        <Input
          type="date"
          max={keIsoTanggal(new Date())}
          value={saring.tanggal_sampai}
          onChange={(e) => setSaring((s) => ({ ...s, tanggal_sampai: e.target.value }))}
        />
      </div>

      {data.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Rangka key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong
          ikon={LuImage}
          judul="Belum ada bukti bayar"
          keterangan="Unggah foto bukti pembayaran QRIS di kotak atas. Bisa dikerjakan setelah lapak sepi."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-coklat-400">
            <span className="angka font-bold text-coklat-900">{daftar.length}</span> berkas
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {daftar.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setDilihat(m)}
                className="group overflow-hidden rounded-2xl border-2 border-netral-200 bg-white text-left transition-colors hover:border-boom-500"
              >
                <div className="aspect-square overflow-hidden bg-coklat-50">
                  <img
                    src={m.url}
                    alt={m.nama_berkas}
                    loading="lazy"
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-bold text-coklat-900">{m.nama_berkas}</p>
                  <p className="mt-0.5 text-xs text-coklat-400">{tanggalJam(m.diunggah_pada)}</p>

                  {/* Siapa yang mengunggah sengaja dibuat menonjol, karena
                      berkas di sini tidak menempel ke transaksi tertentu -
                      nama inilah petunjuk utama kalau ada selisih uang. */}
                  <span className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-coklat-50 px-1.5 py-1">
                    <span className="grid size-4.5 shrink-0 place-items-center rounded bg-boom-500 text-[10px] font-bold text-white">
                      {m.nama_pengunggah.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate text-xs font-semibold text-coklat-900">
                      {m.nama_pengunggah}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Pratinjau besar */}
      {dilihat && (
        <div className="fixed inset-0 z-50 flex flex-col bg-coklat-900/90 p-4">
          <div className="flex shrink-0 items-start justify-between gap-4 pb-3 text-white">
            <div className="min-w-0">
              <p className="truncate font-bold">{dilihat.nama_berkas}</p>
              <p className="text-sm text-white/70">
                {tanggalJam(dilihat.diunggah_pada)} &middot; oleh {dilihat.nama_pengunggah}
              </p>
              {dilihat.catatan && (
                <p className="mt-1 text-sm text-white/70">{dilihat.catatan}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="bahaya" ukuran="kecil" onClick={() => hapus(dilihat)}>
                <LuTrash2 /> Hapus
              </Button>
              <button
                aria-label="Tutup"
                onClick={() => setDilihat(null)}
                className="rounded-lg p-2 text-white hover:bg-white/10"
              >
                <LuX className="size-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <img
              src={dilihat.url}
              alt={dilihat.nama_berkas}
              className="mx-auto size-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
