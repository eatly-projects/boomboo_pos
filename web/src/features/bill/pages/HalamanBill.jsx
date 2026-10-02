import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuPlus, LuSearch, LuX, LuNotebookPen, LuClock, LuChevronRight,
  LuTriangleAlert, LuUser, LuRefreshCw,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { rupiah, angka, tanggalJam, lamanya, nomorWaTampil } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, Kolom } from '@/shared/components/ui/input';
import { Pilihan } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import {
  KepalaHalaman, Kosong, Rangka, Label, KotakAngka, Pemberitahuan,
} from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

const STATUS = [
  { nilai: 'terbuka', label: 'Masih terbuka' },
  { nilai: 'selesai', label: 'Sudah dibayar' },
  { nilai: 'batal', label: 'Dibatalkan' },
];

/* ---------------------------------------------------------------- */

function FormBukaBill({ terbuka, onTutup }) {
  const klien = useQueryClient();
  const navigate = useNavigate();
  const [isian, setIsian] = useState({ nama_pembeli: '', nomor_wa: '', penanda: '' });
  const [sedangKirim, setSedangKirim] = useState(false);

  const ubah = (k) => (e) => setIsian((s) => ({ ...s, [k]: e.target.value }));

  async function kirim(e) {
    e.preventDefault();
    if (!isian.nama_pembeli.trim()) return toast.error('Nama pembeli wajib diisi.');

    setSedangKirim(true);
    try {
      const hasil = await denganToast(
        () =>
          api.post('/bill', {
            nama_pembeli: isian.nama_pembeli.trim(),
            nomor_wa: isian.nomor_wa.trim() || null,
            penanda: isian.penanda.trim() || null,
          }),
        { memuat: 'Membuka bill...', sukses: (d) => d.pesan }
      );
      klien.invalidateQueries({ queryKey: ['bill'] });
      onTutup();
      navigate(`/bill/${hasil.data.id}`);
    } catch {
      setSedangKirim(false);
    }
  }

  return (
    <Dialog open={terbuka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent
        judul="Buka Bill Baru"
        keterangan="Isi dulu nama pembeli di awal. Nomor WhatsApp yang diisi di sini langsung dipakai untuk mengirim struk nanti, jadi kasir tidak perlu menanyakannya lagi saat bayar."
      >
        <form onSubmit={kirim} className="space-y-4">
          <Kolom label="Nama pembeli" wajib>
            <Input
              autoFocus
              placeholder="Contoh: Pak Budi"
              value={isian.nama_pembeli}
              onChange={ubah('nama_pembeli')}
              required
            />
          </Kolom>

          <Kolom
            label="Nomor WhatsApp"
            bantuan="Boleh dikosongkan, tapi kalau diisi sekarang struknya otomatis masuk antrian kirim saat bill ditutup."
          >
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="Contoh: 081234567890"
              value={isian.nomor_wa}
              onChange={ubah('nomor_wa')}
            />
          </Kolom>

          <Kolom
            label="Penanda"
            bantuan="Supaya gampang dicari kalau ada dua pembeli yang namanya sama."
          >
            <Input
              placeholder="Contoh: Meja 4, atau Baju merah"
              value={isian.penanda}
              onChange={ubah('penanda')}
            />
          </Kolom>

          <DialogFooter>
            <Button type="button" variant="garis" onClick={onTutup} disabled={sedangKirim}>
              Batal
            </Button>
            <Button type="submit" disabled={sedangKirim}>
              {sedangKirim ? 'Membuka...' : 'Buka bill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- */

export default function HalamanBill() {
  const [cari, setCari] = useState('');
  const [kataCari, setKataCari] = useState('');
  const [status, setStatus] = useState('terbuka');
  const [formTerbuka, setFormTerbuka] = useState(false);

  useEffect(() => {
    const jeda = setTimeout(() => setKataCari(cari.trim()), 350);
    return () => clearTimeout(jeda);
  }, [cari]);

  const params = { status, ...(kataCari ? { cari: kataCari } : {}) };

  const data = useQuery({
    queryKey: ['bill', params],
    queryFn: () => ambil('/bill', { params }),
    refetchInterval: 20000,
    placeholderData: (sebelumnya) => sebelumnya,
  });

  const sorotan = useQuery({
    queryKey: ['bill', 'sorotan'],
    queryFn: () => ambil('/bill/sorotan'),
    refetchInterval: 20000,
  });

  const daftar = data.data?.daftar || [];
  const total = data.data?.halaman?.total ?? 0;
  const s = sorotan.data;

  return (
    <div>
      <KepalaHalaman
        judul="Open Bill"
        keterangan="Tagihan yang terus berjalan sampai kasir menutupnya. Stok langsung berkurang setiap barang dimasukkan."
        aksi={
          <>
            <Button variant="garis" onClick={() => data.refetch()} disabled={data.isFetching}>
              <LuRefreshCw className={data.isFetching ? 'animate-spin' : undefined} />
              Muat ulang
            </Button>
            <Button onClick={() => setFormTerbuka(true)}>
              <LuPlus /> Buka Bill Baru
            </Button>
          </>
        }
      />

      {sorotan.isLoading ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Rangka key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <KotakAngka
            judul="Bill masih terbuka"
            nilai={angka(s?.bill_terbuka ?? 0)}
            keterangan="Belum dibayar"
            ikon={LuNotebookPen}
            warna={s?.bill_terbuka > 0 ? 'kuning' : 'netral'}
          />
          <KotakAngka
            judul="Nilai yang tertahan"
            nilai={rupiah(s?.nilai_tertahan ?? 0)}
            keterangan="Barang sudah keluar, uang belum masuk"
            ikon={LuClock}
          />
          <KotakAngka
            judul="Terbuka lebih dari 2 jam"
            nilai={angka(s?.terbuka_lama ?? 0)}
            keterangan="Perlu ditengok, mungkin pembelinya sudah pergi"
            ikon={LuTriangleAlert}
            warna={s?.terbuka_lama > 0 ? 'merah' : 'netral'}
          />
        </div>
      )}

      {s?.terbuka_lama > 0 && (
        <Pemberitahuan warna="kuning" className="mb-4" ikon={LuTriangleAlert} judul="Ada bill yang lama sekali terbuka">
          Stoknya sudah berkurang sejak barangnya dipesan. Kalau pembelinya memang sudah pergi,
          batalkan billnya supaya stok itu kembali dan bisa dijual ke orang lain.
        </Pemberitahuan>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
          <Input
            placeholder="Cari nama pembeli, nomor telepon, penanda, atau nomor bill..."
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
        <Pilihan nilai={status} onUbah={setStatus} daftar={STATUS} className="sm:w-56" />
      </div>

      {data.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Rangka key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong
          ikon={LuNotebookPen}
          judul={kataCari ? 'Tidak ada yang cocok' : 'Belum ada bill'}
          keterangan={
            kataCari
              ? `Tidak ditemukan bill dengan kata "${kataCari}".`
              : status === 'terbuka'
                ? 'Semua bill sudah dibereskan. Tekan Buka Bill Baru kalau ada pembeli yang mau pesan dulu dan bayar belakangan.'
                : 'Belum ada bill dengan status itu.'
          }
          aksi={
            !kataCari &&
            status === 'terbuka' && (
              <Button onClick={() => setFormTerbuka(true)}>
                <LuPlus /> Buka Bill Baru
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-coklat-400">
            <span className="angka font-bold text-coklat-900">{total}</span> bill
            {status === 'terbuka' ? ' masih terbuka' : ''}
          </p>

          <div className="space-y-2">
            {daftar.map((b) => {
              const lama = b.detik_terbuka > 7200 && b.status === 'terbuka';
              return (
                <Link
                  key={b.id}
                  to={`/bill/${b.id}`}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border-2 bg-white p-3 transition-colors hover:border-boom-500',
                    lama ? 'border-terakota-500' : 'border-netral-200'
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-boom-500 font-bold text-white">
                    {b.nama_pembeli.charAt(0).toUpperCase()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-coklat-900">{b.nama_pembeli}</p>
                      {b.penanda && <Label warna="netral">{b.penanda}</Label>}
                      {b.status === 'terbuka' && lama && (
                        <Label warna="merah">
                          <LuTriangleAlert className="size-3" /> {lamanya(b.detik_terbuka)}
                        </Label>
                      )}
                      {b.status === 'selesai' && <Label warna="hijau">Sudah dibayar</Label>}
                      {b.status === 'batal' && <Label warna="merah">Dibatalkan</Label>}
                    </div>

                    <p className="angka mt-0.5 text-sm text-coklat-600">
                      {b.nomor}
                      {b.nomor_wa && ` · ${nomorWaTampil(b.nomor_wa)}`}
                    </p>
                    <p className="angka text-xs text-coklat-400">
                      {b.jumlah_barang} barang &middot; dibuka {tanggalJam(b.dibuka_pada)}
                      {b.status === 'terbuka' && ` · berjalan ${lamanya(b.detik_terbuka)}`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="angka font-extrabold text-coklat-900">{rupiah(b.subtotal)}</p>
                    <p className="text-xs text-coklat-400">
                      {b.status === 'terbuka' ? 'berjalan' : 'total'}
                    </p>
                  </div>

                  <LuChevronRight className="size-4 shrink-0 text-netral-300" />
                </Link>
              );
            })}
          </div>
        </>
      )}

      {formTerbuka && <FormBukaBill terbuka onTutup={() => setFormTerbuka(false)} />}
    </div>
  );
}
