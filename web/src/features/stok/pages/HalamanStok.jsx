import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuPlus, LuMinus, LuSearch, LuHistory, LuClipboardCheck,
  LuTriangleAlert, LuBoxes, LuX,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { angka, tanggalJam } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, Kolom, Textarea } from '@/shared/components/ui/input';
import { Pilihan } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { KepalaHalaman, Kosong, Rangka, Label, Pemberitahuan, KotakAngka } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

const ALASAN = [
  { nilai: 'rusak', label: 'Rusak' },
  { nilai: 'tumpah', label: 'Tumpah' },
  { nilai: 'hilang', label: 'Hilang' },
  { nilai: 'koreksi hitungan', label: 'Koreksi hitungan' },
];

function FormGerakStok({ produk, arah, terbuka, onTutup }) {
  const klien = useQueryClient();
  const menambah = arah === 'tambah';

  const [jumlah, setJumlah] = useState('');
  const [alasan, setAlasan] = useState('rusak');
  const [catatan, setCatatan] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);

  const hasil = jumlah === '' ? null : produk.stok + (menambah ? Number(jumlah) : -Number(jumlah));
  const jadiMinus = hasil !== null && hasil < 0;

  async function kirim(e) {
    e.preventDefault();
    if (!jumlah || Number(jumlah) <= 0) return toast.error('Jumlah harus lebih dari 0.');
    if (jadiMinus) return toast.error('Stok tidak boleh minus.');

    setSedangKirim(true);
    try {
      await denganToast(
        () =>
          api.post(`/stok/${produk.id}/${menambah ? 'tambah' : 'kurang'}`, {
            jumlah: Number(jumlah),
            ...(menambah ? {} : { alasan }),
            catatan: catatan.trim() || undefined,
          }),
        { memuat: 'Menyimpan pergerakan stok...', sukses: (d) => d.pesan }
      );
      klien.invalidateQueries({ queryKey: ['stok'] });
      klien.invalidateQueries({ queryKey: ['produk'] });
      onTutup();
    } catch {
      setSedangKirim(false);
    }
  }

  return (
    <Dialog open={terbuka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent
        judul={`${menambah ? 'Tambah' : 'Kurangi'} Stok`}
        keterangan={`${produk.nama} — stok sekarang ${produk.stok}`}
      >
        <form onSubmit={kirim} className="space-y-4">
          <Kolom label={`Jumlah yang ${menambah ? 'ditambahkan' : 'dikurangi'}`} wajib>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              autoFocus
              placeholder="Contoh: 50"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              className="h-14 text-center text-2xl font-extrabold"
              required
            />
          </Kolom>

          {!menambah && (
            <Kolom
              label="Alasan pengurangan"
              wajib
              bantuan="Alasan ini tercatat di log, supaya setelah event ketahuan berapa kerugian dari barang rusak."
            >
              <Pilihan nilai={alasan} onUbah={setAlasan} daftar={ALASAN} />
            </Kolom>
          )}

          <Kolom label="Catatan" bantuan="Boleh dikosongkan.">
            <Textarea
              rows={2}
              placeholder={
                menambah ? 'Contoh: Kiriman dari gudang' : 'Contoh: Tutup botol penyok'
              }
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </Kolom>

          {hasil !== null && (
            <div
              className={cn(
                'rounded-xl border-2 p-4 text-center',
                jadiMinus ? 'border-boom-200 bg-boom-50' : 'border-netral-200 bg-netral-100'
              )}
            >
              <p className="text-sm text-coklat-600">Stok setelah disimpan</p>
              <p
                className={cn(
                  'angka mt-0.5 text-3xl font-extrabold',
                  jadiMinus ? 'text-boom-600' : 'text-coklat-900'
                )}
              >
                {angka(hasil)}
              </p>
              {jadiMinus && (
                <p className="mt-1 text-xs font-bold text-boom-600">
                  Stok tidak boleh minus. Kurangi jumlahnya.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="garis" onClick={onTutup} disabled={sedangKirim}>
              Batal
            </Button>
            <Button
              type="submit"
              variant={menambah ? 'utama' : 'bahaya'}
              disabled={sedangKirim || jadiMinus}
            >
              {sedangKirim ? 'Menyimpan...' : menambah ? 'Tambah stok' : 'Kurangi stok'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HalamanStok() {
  const [cari, setCari] = useState('');
  const [dialog, setDialog] = useState(null); // { produk, arah }

  const stok = useQuery({ queryKey: ['stok'], queryFn: () => ambil('/stok') });

  const daftar = (stok.data || []).filter((p) =>
    p.nama.toLowerCase().includes(cari.trim().toLowerCase())
  );

  const semua = stok.data || [];
  const tidakCocok = semua.filter((p) => !p.cocok);
  const habis = semua.filter((p) => p.stok <= 0);
  const menipis = semua.filter((p) => p.stok > 0 && p.stok <= 10);
  const totalBarang = semua.reduce((t, p) => t + Math.max(p.stok, 0), 0);

  return (
    <div>
      <KepalaHalaman
        judul="Stok"
        keterangan="Setiap perubahan stok tercatat lengkap: berapa, kenapa, dan siapa yang melakukannya."
        aksi={
          <Button variant="garis" asChild>
            <Link to="/stok/opname">
              <LuClipboardCheck /> Stok Opname
            </Link>
          </Button>
        }
      />

      {stok.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Rangka key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KotakAngka
            judul="Total barang tersedia"
            nilai={angka(totalBarang)}
            keterangan={`Dari ${semua.length} jenis produk`}
            ikon={LuBoxes}
          />
          <KotakAngka
            judul="Stok habis"
            nilai={angka(habis.length)}
            keterangan="Tidak bisa dijual di kasir"
            ikon={LuTriangleAlert}
            warna={habis.length > 0 ? 'merah' : 'netral'}
          />
          <KotakAngka
            judul="Stok menipis"
            nilai={angka(menipis.length)}
            keterangan="Sisa 10 atau kurang"
            ikon={LuTriangleAlert}
            warna={menipis.length > 0 ? 'kuning' : 'netral'}
          />
          <KotakAngka
            judul="Pemeriksaan silang"
            nilai={tidakCocok.length === 0 ? 'Cocok' : `${tidakCocok.length} beda`}
            keterangan="Angka stok vs buku pergerakan"
            ikon={LuClipboardCheck}
            warna={tidakCocok.length === 0 ? 'hijau' : 'merah'}
          />
        </div>
      )}

      {tidakCocok.length > 0 && (
        <Pemberitahuan
          warna="merah"
          className="mt-4"
          ikon={LuTriangleAlert}
          judul="Ada stok yang angkanya tidak cocok dengan buku pergerakan"
        >
          Ini tidak wajar dan sebaiknya segera diperiksa:{' '}
          {tidakCocok.map((p) => p.nama).join(', ')}.
        </Pemberitahuan>
      )}

      <div className="relative my-4">
        <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
        <Input
          placeholder="Cari nama produk..."
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

      {stok.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Rangka key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong
          ikon={LuBoxes}
          judul={cari ? 'Tidak ada yang cocok' : 'Belum ada produk'}
          keterangan={
            cari
              ? `Tidak ditemukan produk dengan kata "${cari}".`
              : 'Tambahkan produk dulu di halaman Produk, baru stoknya bisa diisi di sini.'
          }
        />
      ) : (
        <div className="space-y-2">
          {daftar.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-netral-200 bg-white p-3"
            >
              <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-coklat-50">
                {p.foto_url ? (
                  <img src={p.foto_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-coklat-200">
                    <LuBoxes className="size-5" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-coklat-900">{p.nama}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'angka text-sm font-extrabold',
                      p.stok <= 0 ? 'text-boom-600' : p.stok <= 10 ? 'text-terakota-500' : 'text-coklat-900'
                    )}
                  >
                    Stok {angka(p.stok)}
                  </span>
                  {p.stok <= 0 && <Label warna="merah">Habis</Label>}
                  {p.stok > 0 && p.stok <= 10 && <Label warna="kuning">Menipis</Label>}
                  {!p.cocok && <Label warna="merah">Tidak cocok dengan buku</Label>}
                  {p.pergerakan_terakhir && (
                    <span className="text-xs text-coklat-400">
                      Terakhir bergerak {tanggalJam(p.pergerakan_terakhir)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-1.5">
                <Button ukuran="kecil" onClick={() => setDialog({ produk: p, arah: 'tambah' })}>
                  <LuPlus /> Tambah
                </Button>
                <Button
                  ukuran="kecil"
                  variant="bahaya"
                  onClick={() => setDialog({ produk: p, arah: 'kurang' })}
                >
                  <LuMinus /> Kurangi
                </Button>
                <Button ukuran="kecil" variant="polos" asChild>
                  <Link to={`/stok/${p.id}`}>
                    <LuHistory /> Riwayat
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <FormGerakStok
          key={`${dialog.produk.id}-${dialog.arah}`}
          produk={dialog.produk}
          arah={dialog.arah}
          terbuka
          onTutup={() => setDialog(null)}
        />
      )}
    </div>
  );
}
