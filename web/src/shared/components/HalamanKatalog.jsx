import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuPlus, LuSearch, LuPencil, LuArchive, LuArchiveRestore, LuImagePlus,
  LuPackageOpen, LuX, LuTriangleAlert,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { rupiah, tanggalJam } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, InputRupiah, Kolom } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { KepalaHalaman, Kosong, Rangka, Label, Pemberitahuan } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

const KOSONG = { nama: '', harga: '', harga_diskon: '', nama_diskon: '' };

function FormBarang({ jalur, label, barang, terbuka, onTutup }) {
  const klien = useQueryClient();
  const sedangUbah = Boolean(barang);

  const [isian, setIsian] = useState(
    barang
      ? {
          nama: barang.nama,
          // Harga disimpan sebagai angka biasa. Tampilan rupiahnya diurus
          // oleh komponen InputRupiah, bukan oleh nilai yang disimpan di sini.
          harga: barang.harga,
          harga_diskon: barang.harga_diskon != null ? barang.harga_diskon : '',
          nama_diskon: barang.nama_diskon || '',
        }
      : KOSONG
  );
  const [sedangKirim, setSedangKirim] = useState(false);

  const ubah = (k) => (e) => setIsian((s) => ({ ...s, [k]: e.target.value }));
  const ubahAngka = (k) => (nilai) => setIsian((s) => ({ ...s, [k]: nilai }));
  const adaDiskon = isian.harga_diskon !== '';

  async function kirim(e) {
    e.preventDefault();

    if (isian.harga === '') return toast.error('Harga normal wajib diisi.');

    const data = {
      nama: isian.nama.trim(),
      harga: Number(isian.harga),
      harga_diskon: adaDiskon ? Number(isian.harga_diskon) : null,
      nama_diskon: adaDiskon ? isian.nama_diskon.trim() : null,
    };

    if (adaDiskon && !data.nama_diskon)
      return toast.error('Nama diskon wajib diisi kalau harga diskon diisi.');
    if (adaDiskon && data.harga_diskon > data.harga)
      return toast.error('Harga diskon tidak boleh lebih besar dari harga normal.');

    setSedangKirim(true);
    try {
      await denganToast(
        () => (sedangUbah ? api.patch(`${jalur}/${barang.id}`, data) : api.post(jalur, data)),
        { memuat: 'Menyimpan...', sukses: (d) => d.pesan }
      );
      klien.invalidateQueries({ queryKey: [jalur.replace('/', '')] });
      onTutup();
    } catch {
      setSedangKirim(false);
    }
  }

  return (
    <Dialog open={terbuka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent
        judul={sedangUbah ? `Ubah ${label}` : `Tambah ${label} Baru`}
        keterangan={
          sedangUbah
            ? 'Perubahan akan tercatat di log beserta nama Anda.'
            : jalur === '/produk'
              ? 'Stok tidak diisi di sini. Produk baru selalu mulai dari 0, lalu diisi di halaman Stok.'
              : 'Menu tidak punya stok, jadi bisa langsung dijual setelah disimpan.'
        }
      >
        <form onSubmit={kirim} className="space-y-4">
          <Kolom label={`Nama ${label}`} wajib>
            <Input
              autoFocus
              placeholder={
                jalur === '/produk' ? 'Contoh: Sambal Bawang 100g' : 'Contoh: Nasi Ayam Sambal'
              }
              value={isian.nama}
              onChange={ubah('nama')}
              required
            />
          </Kolom>

          <Kolom label="Harga normal" wajib bantuan="Ketik angkanya saja, titik ribuan muncul sendiri.">
            <InputRupiah
              placeholder="Contoh: 35000"
              value={isian.harga}
              onChange={ubahAngka('harga')}
              required
            />
          </Kolom>

          <div className="rounded-xl border-2 border-netral-200 p-3.5">
            <p className="text-sm font-bold text-coklat-900">Harga diskon</p>
            <p className="mb-3 mt-0.5 text-xs text-coklat-400">
              Boleh dikosongkan. Kalau diisi, harga inilah yang otomatis dipakai kasir.
            </p>

            <div className="space-y-3">
              <Kolom label="Harga setelah diskon">
                <InputRupiah
                  placeholder="Kosongkan kalau tidak ada diskon"
                  value={isian.harga_diskon}
                  onChange={ubahAngka('harga_diskon')}
                />
              </Kolom>

              <Kolom
                label="Nama diskon"
                wajib={adaDiskon}
                bantuan={
                  adaDiskon
                    ? 'Nama ini muncul di layar kasir dan di struk pembeli.'
                    : 'Aktif setelah harga diskon diisi.'
                }
              >
                <Input
                  placeholder="Contoh: Promo Event"
                  value={isian.nama_diskon}
                  onChange={ubah('nama_diskon')}
                  disabled={!adaDiskon}
                  required={adaDiskon}
                />
              </Kolom>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="garis" onClick={onTutup} disabled={sedangKirim}>
              Batal
            </Button>
            <Button type="submit" disabled={sedangKirim}>
              {sedangKirim ? 'Menyimpan...' : sedangUbah ? 'Simpan perubahan' : `Tambah ${label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BarisBarang({ barang, jalur, label, punyaStok, onUbah }) {
  const klien = useQueryClient();
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const diarsipkan = Boolean(barang.diarsipkan_pada);

  async function unggahFoto(e) {
    const berkas = e.target.files?.[0];
    if (!berkas) return;
    const data = new FormData();
    data.append('foto', berkas);

    setSedangUnggah(true);
    try {
      await denganToast(() => api.post(`${jalur}/${barang.id}/foto`, data), {
        memuat: 'Mengunggah foto...',
        sukses: 'Foto tersimpan.',
      });
      klien.invalidateQueries({ queryKey: [jalur.replace('/', '')] });
    } catch {
      // toast sudah muncul
    } finally {
      setSedangUnggah(false);
      e.target.value = '';
    }
  }

  async function ubahArsip() {
    try {
      await denganToast(
        () =>
          diarsipkan
            ? api.post(`${jalur}/${barang.id}/pulihkan`)
            : api.delete(`${jalur}/${barang.id}`),
        { memuat: 'Memproses...', sukses: (d) => d.pesan }
      );
      klien.invalidateQueries({ queryKey: [jalur.replace('/', '')] });
    } catch {
      // toast sudah muncul
    }
  }

  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border-2 border-netral-200 bg-white p-3',
        diarsipkan && 'opacity-60'
      )}
    >
      {/* Foto */}
      <label
        className={cn(
          'group relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-coklat-50',
          sedangUnggah && 'pointer-events-none animate-pulse'
        )}
      >
        {barang.foto_url ? (
          <img src={barang.foto_url} alt={barang.nama} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-coklat-200">
            <LuImagePlus className="size-6" />
          </span>
        )}
        <span className="absolute inset-0 hidden place-items-center bg-coklat-900/50 text-white group-hover:grid">
          <LuImagePlus className="size-5" />
        </span>
        <input type="file" accept="image/*" className="sr-only" onChange={unggahFoto} />
      </label>

      {/* Keterangan */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-coklat-900">{barang.nama}</p>
          {diarsipkan && <Label warna="netral">Diarsipkan</Label>}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="angka font-extrabold text-boom-600">
            {rupiah(barang.harga_diskon ?? barang.harga)}
          </span>
          {barang.harga_diskon != null && (
            <>
              <span className="angka text-sm text-coklat-400 line-through">
                {rupiah(barang.harga)}
              </span>
              <Label warna="hijau">{barang.nama_diskon}</Label>
            </>
          )}
        </div>

        {punyaStok && (
          <p
            className={cn(
              'angka mt-1 text-sm font-semibold',
              barang.stok <= 0 ? 'text-boom-600' : 'text-coklat-400'
            )}
          >
            Stok: {barang.stok}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button ukuran="kecil" variant="garis" onClick={() => onUbah(barang)}>
            <LuPencil /> Ubah
          </Button>
          <Button ukuran="kecil" variant="polos" onClick={ubahArsip}>
            {diarsipkan ? (
              <>
                <LuArchiveRestore /> Kembalikan
              </>
            ) : (
              <>
                <LuArchive /> Arsipkan
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Halaman katalog yang dipakai bersama oleh Produk dan Menu.
 * Keduanya hampir sama persis, bedanya cuma Produk menampilkan stok.
 */
export default function HalamanKatalog({ jalur, label, labelJamak, keterangan, punyaStok }) {
  const kunci = jalur.replace('/', '');
  const [cari, setCari] = useState('');
  const [termasukArsip, setTermasukArsip] = useState(false);
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [yangDiubah, setYangDiubah] = useState(null);

  const daftar = useQuery({
    queryKey: [kunci, { termasukArsip }],
    queryFn: () => ambil(jalur, { params: { termasuk_arsip: termasukArsip } }),
  });

  const hasil = (daftar.data || []).filter((b) =>
    b.nama.toLowerCase().includes(cari.trim().toLowerCase())
  );

  function bukaTambah() {
    setYangDiubah(null);
    setFormTerbuka(true);
  }
  function bukaUbah(barang) {
    setYangDiubah(barang);
    setFormTerbuka(true);
  }

  return (
    <div>
      <KepalaHalaman
        judul={labelJamak}
        keterangan={keterangan}
        aksi={
          <Button onClick={bukaTambah}>
            <LuPlus /> Tambah {label}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
          <Input
            placeholder={`Cari nama ${label.toLowerCase()}...`}
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

        <Button
          variant={termasukArsip ? 'utama' : 'garis'}
          onClick={() => setTermasukArsip((v) => !v)}
        >
          <LuArchive />
          {termasukArsip ? 'Sembunyikan arsip' : 'Tampilkan arsip'}
        </Button>
      </div>

      {punyaStok && (
        <Pemberitahuan warna="netral" className="mb-4" ikon={LuTriangleAlert}>
          Menambah produk di sini <strong>tidak</strong> mengisi stok. Stok diisi terpisah di
          halaman Stok, supaya setiap perubahannya tercatat rapi.
        </Pemberitahuan>
      )}

      {daftar.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Rangka key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : hasil.length === 0 ? (
        <Kosong
          ikon={LuPackageOpen}
          judul={cari ? 'Tidak ada yang cocok' : `Belum ada ${label.toLowerCase()}`}
          keterangan={
            cari
              ? `Tidak ditemukan dengan kata "${cari}". Coba kata lain.`
              : `Tambahkan ${label.toLowerCase()} pertama Anda untuk mulai berjualan.`
          }
          aksi={
            !cari && (
              <Button onClick={bukaTambah}>
                <LuPlus /> Tambah {label}
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-coklat-400">
            Menampilkan <span className="angka font-bold text-coklat-900">{hasil.length}</span>{' '}
            {label.toLowerCase()}
            {termasukArsip && ' (termasuk yang diarsipkan)'}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {hasil.map((b) => (
              <BarisBarang
                key={b.id}
                barang={b}
                jalur={jalur}
                label={label}
                punyaStok={punyaStok}
                onUbah={bukaUbah}
              />
            ))}
          </div>
        </>
      )}

      {formTerbuka && (
        <FormBarang
          key={yangDiubah?.id || 'baru'}
          jalur={jalur}
          label={label}
          barang={yangDiubah}
          terbuka={formTerbuka}
          onTutup={() => setFormTerbuka(false)}
        />
      )}
    </div>
  );
}
