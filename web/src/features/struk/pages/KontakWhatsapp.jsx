import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LuSearch, LuPhone, LuUsers, LuMessageCircle } from 'react-icons/lu';
import { ambil } from '@/shared/lib/api';
import { rupiah, tanggalPanjang, nomorWaTampil, angka } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { KepalaHalaman, Kosong, Rangka, KotakAngka } from '@/shared/components/ui/tampilan';

export default function KontakWhatsapp() {
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(1);

  const data = useQuery({
    queryKey: ['kontak', { cari, halaman }],
    queryFn: () =>
      ambil('/struk/kontak', { params: { halaman, per_halaman: 30, ...(cari ? { cari } : {}) } }),
  });

  const daftar = data.data?.daftar || [];
  const info = data.data?.halaman;
  const totalHalaman = info ? Math.max(Math.ceil(info.total / info.per_halaman), 1) : 1;

  const totalBelanja = daftar.reduce((t, k) => t + k.total_belanja, 0);
  const pelangganUlang = daftar.filter((k) => k.jumlah_transaksi > 1).length;

  return (
    <div>
      <KepalaHalaman
        judul="Kontak WhatsApp"
        keterangan="Nomor pembeli yang pernah dikirimi struk. Ini aset pemasaran Boomboo."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KotakAngka
          judul="Total kontak tersimpan"
          nilai={angka(info?.total ?? 0)}
          keterangan="Nomor unik, tidak ada yang ganda"
          ikon={LuUsers}
        />
        <KotakAngka
          judul="Pelanggan yang belanja ulang"
          nilai={angka(pelangganUlang)}
          keterangan="Dari yang tampil di halaman ini"
          ikon={LuMessageCircle}
          warna="hijau"
        />
        <KotakAngka
          judul="Total belanja di halaman ini"
          nilai={rupiah(totalBelanja)}
          keterangan={`Dari ${daftar.length} kontak`}
          ikon={LuPhone}
        />
      </div>

      <div className="relative mb-4">
        <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
        <Input
          placeholder="Cari nama atau nomor..."
          value={cari}
          onChange={(e) => {
            setCari(e.target.value);
            setHalaman(1);
          }}
          className="pl-10"
        />
      </div>

      {data.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Rangka key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong
          ikon={LuPhone}
          judul={cari ? 'Tidak ada yang cocok' : 'Belum ada kontak'}
          keterangan={
            cari
              ? `Tidak ditemukan kontak dengan kata "${cari}".`
              : 'Kontak terkumpul otomatis setiap kali pembeli memberikan nomor WhatsApp-nya di kasir.'
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {daftar.map((k) => (
              <div
                key={k.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-netral-200 bg-white p-3"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-daun-50 text-sm font-bold text-daun-700">
                  {(k.nama || '?').charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-coklat-900">{k.nama || 'Tanpa nama'}</p>
                  <p className="angka text-sm text-coklat-600">{nomorWaTampil(k.nomor)}</p>
                  <p className="angka mt-0.5 text-xs text-coklat-400">
                    {k.jumlah_transaksi} kali belanja &middot; terakhir{' '}
                    {tanggalPanjang(k.terakhir_pada)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="angka font-extrabold text-coklat-900">
                    {rupiah(k.total_belanja)}
                  </p>
                  <Button variant="polos" ukuran="kecil" className="mt-0.5" asChild>
                    <a href={`https://wa.me/${k.nomor}`} target="_blank" rel="noreferrer">
                      <LuMessageCircle /> Chat
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalHalaman > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="garis"
                disabled={halaman <= 1}
                onClick={() => setHalaman((h) => h - 1)}
              >
                Sebelumnya
              </Button>
              <p className="angka text-sm text-coklat-400">
                Halaman {halaman} dari {totalHalaman}
              </p>
              <Button
                variant="garis"
                disabled={halaman >= totalHalaman}
                onClick={() => setHalaman((h) => h + 1)}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
