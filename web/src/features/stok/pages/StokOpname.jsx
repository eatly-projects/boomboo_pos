import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LuArrowLeft, LuClipboardCheck, LuBoxes, LuTriangleAlert } from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { angka } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { KepalaHalaman, Kosong, Rangka, Pemberitahuan } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

export default function StokOpname() {
  const klien = useQueryClient();
  const navigate = useNavigate();
  const [hitungan, setHitungan] = useState({});
  const [sedangKirim, setSedangKirim] = useState(false);

  const stok = useQuery({ queryKey: ['stok'], queryFn: () => ambil('/stok') });
  const daftar = stok.data || [];

  const terisi = daftar.filter((p) => hitungan[p.id] !== undefined && hitungan[p.id] !== '');
  const berubah = terisi.filter((p) => Number(hitungan[p.id]) !== p.stok);

  async function simpan() {
    if (terisi.length === 0) return toast.error('Isi dulu hasil hitung fisiknya.');

    setSedangKirim(true);
    try {
      const hasil = await denganToast(
        () =>
          api.post('/stok/opname', {
            hitungan: terisi.map((p) => ({
              produk_id: p.id,
              jumlah_fisik: Number(hitungan[p.id]),
            })),
          }),
        { memuat: 'Menyimpan hasil opname...', sukses: (d) => d.pesan }
      );
      klien.invalidateQueries({ queryKey: ['stok'] });
      klien.invalidateQueries({ queryKey: ['produk'] });
      navigate('/stok');
      return hasil;
    } catch {
      setSedangKirim(false);
    }
  }

  return (
    <div>
      <Button variant="polos" className="mb-3 -ml-3" asChild>
        <Link to="/stok">
          <LuArrowLeft /> Kembali ke Stok
        </Link>
      </Button>

      <KepalaHalaman
        judul="Stok Opname"
        keterangan="Hitung barang fisik di lapak, lalu masukkan jumlahnya di sini. Sistem otomatis menyesuaikan selisihnya."
      />

      <Pemberitahuan warna="netral" className="mb-4" ikon={LuClipboardCheck}>
        Produk yang <strong>tidak Anda isi</strong> akan dilewati, stoknya tidak berubah sama
        sekali. Yang jumlahnya sudah pas juga tidak menghasilkan catatan apa pun.
      </Pemberitahuan>

      {stok.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Rangka key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong ikon={LuBoxes} judul="Belum ada produk" keterangan="Tambahkan produk dulu." />
      ) : (
        <>
          <div className="space-y-2 pb-28">
            {daftar.map((p) => {
              const nilai = hitungan[p.id] ?? '';
              const diisi = nilai !== '';
              const selisih = diisi ? Number(nilai) - p.stok : null;

              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-2xl border-2 bg-white p-3',
                    diisi && selisih !== 0 ? 'border-terakota-500' : 'border-netral-200'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-coklat-900">{p.nama}</p>
                    <p className="angka mt-0.5 text-sm text-coklat-400">
                      Catatan sistem: {angka(p.stok)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-28">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="Hitung fisik"
                        value={nilai}
                        onChange={(e) =>
                          setHitungan((h) => ({ ...h, [p.id]: e.target.value }))
                        }
                        className="h-11 text-center font-bold"
                      />
                    </div>

                    <div className="w-24 text-right">
                      {diisi && (
                        <p
                          className={cn(
                            'angka text-sm font-extrabold',
                            selisih === 0
                              ? 'text-daun-700'
                              : selisih > 0
                                ? 'text-biru-500'
                                : 'text-boom-600'
                          )}
                        >
                          {selisih === 0
                            ? 'Pas'
                            : `${selisih > 0 ? '+' : ''}${angka(selisih)}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bilah ringkasan yang selalu terlihat */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-netral-200 bg-white p-3 lg:left-64">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-1 sm:px-3">
              <div className="text-sm">
                <p className="angka font-bold text-coklat-900">
                  {terisi.length} dari {daftar.length} produk dihitung
                </p>
                <p className="angka text-coklat-400">
                  {berubah.length === 0
                    ? 'Belum ada selisih'
                    : `${berubah.length} produk akan disesuaikan`}
                </p>
              </div>

              <Button
                ukuran="besar"
                onClick={simpan}
                disabled={sedangKirim || terisi.length === 0}
              >
                <LuClipboardCheck />
                {sedangKirim ? 'Menyimpan...' : 'Simpan hasil opname'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
