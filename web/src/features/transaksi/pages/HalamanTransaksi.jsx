import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LuSearch, LuReceipt, LuFilter, LuTriangleAlert, LuChevronRight } from 'react-icons/lu';
import { ambil } from '@/shared/lib/api';
import {
  rupiah, tanggalJam, keIsoTanggal, labelMetode, labelStatus, rentangTanggal,
} from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, Kolom } from '@/shared/components/ui/input';
import { Pilihan } from '@/shared/components/ui/select';
import { KepalaHalaman, Kosong, Rangka, Label } from '@/shared/components/ui/tampilan';

const STATUS = [
  { nilai: 'semua', label: 'Semua status' },
  { nilai: 'selesai', label: 'Selesai' },
  { nilai: 'menunggu_pembayaran', label: 'Menunggu pembayaran' },
  { nilai: 'batal', label: 'Dibatalkan' },
];

const METODE = [
  { nilai: 'semua', label: 'Semua cara bayar' },
  { nilai: 'qris', label: 'QRIS' },
  { nilai: 'tunai', label: 'Tunai' },
];

const warnaStatus = (s) =>
  ({ selesai: 'hijau', menunggu_pembayaran: 'kuning', batal: 'merah' })[s] || 'netral';

export default function HalamanTransaksi() {
  const hariIni = keIsoTanggal(new Date());
  const [saring, setSaring] = useState({
    cari: '',
    status: 'semua',
    metode_bayar: 'semua',
    tanggal_dari: '',
    tanggal_sampai: '',
  });
  const [halaman, setHalaman] = useState(1);
  const [saringTerbuka, setSaringTerbuka] = useState(false);

  const params = {
    halaman,
    per_halaman: 25,
    ...(saring.cari ? { cari: saring.cari } : {}),
    ...(saring.status !== 'semua' ? { status: saring.status } : {}),
    ...(saring.metode_bayar !== 'semua' ? { metode_bayar: saring.metode_bayar } : {}),
    ...(saring.tanggal_dari ? { tanggal_dari: saring.tanggal_dari } : {}),
    ...(saring.tanggal_sampai ? { tanggal_sampai: saring.tanggal_sampai } : {}),
  };

  const data = useQuery({
    queryKey: ['transaksi', params],
    queryFn: () => ambil('/transaksi', { params }),
  });

  const daftar = data.data?.daftar || [];
  const info = data.data?.halaman;
  const totalHalaman = info ? Math.max(Math.ceil(info.total / info.per_halaman), 1) : 1;

  const ubah = (k) => (v) => {
    setSaring((s) => ({ ...s, [k]: v }));
    setHalaman(1);
  };

  return (
    <div>
      <KepalaHalaman
        judul="Transaksi"
        keterangan={rentangTanggal(saring.tanggal_dari, saring.tanggal_sampai)}
        aksi={
          <Button variant="garis" onClick={() => setSaringTerbuka((v) => !v)}>
            <LuFilter /> {saringTerbuka ? 'Tutup penyaring' : 'Penyaring'}
          </Button>
        }
      />

      <div className="relative mb-3">
        <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
        <Input
          placeholder="Cari nomor transaksi, misalnya BB-20261007-0012"
          value={saring.cari}
          onChange={(e) => ubah('cari')(e.target.value)}
          className="pl-10"
        />
      </div>

      {saringTerbuka && (
        <div className="animasi-naik mb-4 grid gap-3 rounded-2xl border-2 border-netral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kolom label="Status">
            <Pilihan nilai={saring.status} onUbah={ubah('status')} daftar={STATUS} />
          </Kolom>
          <Kolom label="Cara bayar">
            <Pilihan nilai={saring.metode_bayar} onUbah={ubah('metode_bayar')} daftar={METODE} />
          </Kolom>
          <Kolom label="Tanggal mulai">
            <Input
              type="date"
              max={hariIni}
              value={saring.tanggal_dari}
              onChange={(e) => ubah('tanggal_dari')(e.target.value)}
            />
          </Kolom>
          <Kolom label="Tanggal akhir">
            <Input
              type="date"
              max={hariIni}
              value={saring.tanggal_sampai}
              onChange={(e) => ubah('tanggal_sampai')(e.target.value)}
            />
          </Kolom>
        </div>
      )}

      {data.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Rangka key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong
          ikon={LuReceipt}
          judul="Belum ada transaksi"
          keterangan="Tidak ada transaksi yang cocok dengan penyaring yang dipakai sekarang."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-coklat-400">
            Menampilkan{' '}
            <span className="angka font-bold text-coklat-900">{daftar.length}</span> dari{' '}
            <span className="angka font-bold text-coklat-900">{info?.total}</span> transaksi
          </p>

          <div className="space-y-2">
            {daftar.map((t) => (
              <Link
                key={t.id}
                to={`/transaksi/${t.id}`}
                className="flex items-center gap-3 rounded-2xl border-2 border-netral-200 bg-white p-3 transition-colors hover:border-boom-500"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="angka font-bold text-coklat-900">{t.nomor}</span>
                    <Label warna={warnaStatus(t.status)}>{labelStatus(t.status)}</Label>
                    {t.metode_bayar && <Label warna="netral">{labelMetode(t.metode_bayar)}</Label>}
                    {t.ditandai_stok_kurang && (
                      <Label warna="merah">
                        <LuTriangleAlert className="size-3" /> Stok kurang
                      </Label>
                    )}
                  </div>

                  <p className="angka mt-1 text-sm text-coklat-400">
                    {t.jumlah_baris} jenis barang &middot; kasir {t.nama_kasir}
                  </p>
                  <p className="mt-0.5 text-xs text-coklat-400">{tanggalJam(t.dibuat_pada)}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="angka font-extrabold text-coklat-900">{rupiah(t.total)}</p>
                  {t.diskon_rupiah > 0 && (
                    <p className="angka text-xs text-daun-700">
                      Diskon {rupiah(t.diskon_rupiah)}
                    </p>
                  )}
                </div>

                <LuChevronRight className="size-4 shrink-0 text-netral-300" />
              </Link>
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
