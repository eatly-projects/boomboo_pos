import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LuArrowLeft, LuHistory, LuArrowUp, LuArrowDown } from 'react-icons/lu';
import { ambil } from '@/shared/lib/api';
import { angka, tanggalJam } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { KepalaHalaman, Kosong, Rangka, Label } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

const LABEL_JENIS = {
  penambahan: { teks: 'Barang masuk', warna: 'hijau' },
  pengurangan_manual: { teks: 'Dikurangi manual', warna: 'merah' },
  penjualan: { teks: 'Terjual', warna: 'netral' },
  pembatalan: { teks: 'Kembali dari pembatalan', warna: 'kuning' },
  opname: { teks: 'Penyesuaian opname', warna: 'biru' },
};

export default function KartuStok() {
  const { id } = useParams();
  const [halaman, setHalaman] = useState(1);

  const kartu = useQuery({
    queryKey: ['kartu-stok', id, halaman],
    queryFn: () => ambil(`/stok/${id}/kartu`, { params: { halaman, per_halaman: 40 } }),
  });

  const produk = kartu.data?.produk;
  const pergerakan = kartu.data?.pergerakan || [];
  const info = kartu.data?.halaman;
  const totalHalaman = info ? Math.ceil(info.total / info.per_halaman) : 1;

  return (
    <div>
      <Button variant="polos" className="mb-3 -ml-3" asChild>
        <Link to="/stok">
          <LuArrowLeft /> Kembali ke Stok
        </Link>
      </Button>

      <KepalaHalaman
        judul={produk ? `Kartu Stok: ${produk.nama}` : 'Kartu Stok'}
        keterangan="Seluruh riwayat keluar-masuk barang ini, dari yang paling baru."
      />

      {produk && (
        <div className="mb-4 rounded-2xl border-2 border-netral-200 bg-white p-4 text-center sm:text-left">
          <p className="text-sm text-coklat-400">Stok sekarang</p>
          <p className="angka mt-0.5 text-3xl font-extrabold text-coklat-900">
            {angka(produk.stok)}
          </p>
        </div>
      )}

      {kartu.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Rangka key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : pergerakan.length === 0 ? (
        <Kosong
          ikon={LuHistory}
          judul="Belum ada pergerakan"
          keterangan="Stok produk ini belum pernah ditambah maupun dikurangi."
        />
      ) : (
        <>
          <div className="space-y-2">
            {pergerakan.map((g) => {
              const masuk = g.jumlah > 0;
              const label = LABEL_JENIS[g.jenis] || { teks: g.jenis, warna: 'netral' };

              return (
                <div
                  key={g.id}
                  className="flex gap-3 rounded-2xl border-2 border-netral-200 bg-white p-3"
                >
                  <div
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-xl',
                      masuk ? 'bg-daun-50 text-daun-700' : 'bg-boom-50 text-boom-600'
                    )}
                  >
                    {masuk ? <LuArrowUp className="size-5" /> : <LuArrowDown className="size-5" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label warna={label.warna}>{label.teks}</Label>
                      {g.nomor_transaksi && (
                        <Link
                          to={`/transaksi/${g.transaksi_id}`}
                          className="angka text-xs font-semibold text-biru-500 hover:underline"
                        >
                          {g.nomor_transaksi}
                        </Link>
                      )}
                    </div>

                    <p className="angka mt-1 text-sm text-coklat-600">
                      <span className="font-bold text-coklat-900">
                        {masuk ? '+' : ''}
                        {angka(g.jumlah)}
                      </span>
                      {'  '}&middot;{'  '}
                      {angka(g.stok_sebelum)} menjadi {angka(g.stok_sesudah)}
                    </p>

                    {g.alasan && (
                      <p className="mt-0.5 text-sm capitalize text-coklat-600">
                        Alasan: <span className="font-semibold">{g.alasan}</span>
                      </p>
                    )}
                    {g.catatan && <p className="mt-0.5 text-sm text-coklat-400">{g.catatan}</p>}

                    <p className="mt-1 text-xs text-coklat-400">
                      {g.nama_user} &middot; {tanggalJam(g.dibuat_pada)}
                    </p>
                  </div>
                </div>
              );
            })}
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
