import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuPlus, LuSearch, LuPencil, LuArchive, LuArchiveRestore, LuPackage,
  LuPackageOpen, LuX, LuTriangleAlert, LuUtensils, LuTrash2, LuEyeOff, LuInfo,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { rupiah, angka } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, InputRupiah, Kolom } from '@/shared/components/ui/input';
import { Pilihan } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { KepalaHalaman, Kosong, Rangka, Label, Pemberitahuan } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

const KOSONG = { nama: '', harga: '', harga_diskon: '', nama_diskon: '' };

/* ---------------------------------------------------------------- */
/* Saklar sederhana                                                  */
/* ---------------------------------------------------------------- */
function Saklar({ nyala, onUbah, judul, keterangan }) {
  return (
    <button
      type="button"
      onClick={() => onUbah(!nyala)}
      className="flex w-full items-start gap-3 rounded-xl border-2 border-netral-200 p-3.5 text-left transition-colors hover:border-coklat-200"
    >
      <span
        className={cn(
          'mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
          nyala ? 'bg-daun-500' : 'bg-netral-300'
        )}
      >
        <span
          className={cn(
            'size-5 rounded-full bg-white transition-transform',
            nyala && 'translate-x-5'
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-coklat-900">{judul}</span>
        <span className="mt-0.5 block text-xs text-coklat-400">{keterangan}</span>
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Pemilih penyusun menu                                             */
/* ---------------------------------------------------------------- */
function PemilihPenyusun({ komponen, setKomponen }) {
  const produk = useQuery({
    queryKey: ['produk', 'semua'],
    queryFn: () => ambil('/produk'),
  });
  const daftar = produk.data || [];
  const terpakai = new Set(komponen.map((k) => k.produk_id));
  const tersedia = daftar.filter((p) => !terpakai.has(p.id));

  const [pilih, setPilih] = useState('');

  function tambah() {
    if (!pilih) return toast.error('Pilih dulu produknya.');
    setKomponen([...komponen, { produk_id: pilih, jumlah: 1 }]);
    setPilih('');
  }

  const namaProduk = (id) => daftar.find((p) => p.id === id)?.nama || 'Produk';

  return (
    <div className="rounded-xl border-2 border-netral-200 p-3.5">
      <p className="text-sm font-bold text-coklat-900">Penyusun dari stok</p>
      <p className="mb-3 mt-0.5 text-xs text-coklat-400">
        Boleh dikosongkan. Isi hanya barang yang stoknya memang Anda catat — nasi dan ayam yang
        tidak dihitung satuan tidak perlu didaftarkan. Saat menu ini terjual, stok yang didaftarkan
        di sini ikut berkurang.
      </p>

      {komponen.length > 0 && (
        <div className="mb-3 space-y-2">
          {komponen.map((k, i) => (
            <div key={k.produk_id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-coklat-900">
                {namaProduk(k.produk_id)}
              </span>
              <div className="w-24">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={k.jumlah}
                  onChange={(e) => {
                    const salinan = [...komponen];
                    salinan[i] = { ...k, jumlah: Math.max(Number(e.target.value) || 1, 1) };
                    setKomponen(salinan);
                  }}
                  className="angka h-10 text-center"
                />
              </div>
              <button
                type="button"
                aria-label="Lepaskan penyusun"
                onClick={() => setKomponen(komponen.filter((x) => x.produk_id !== k.produk_id))}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-coklat-400 transition-colors hover:bg-boom-50 hover:text-boom-600"
              >
                <LuTrash2 className="size-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-coklat-400">Angka di kanan = jumlah untuk 1 porsi menu.</p>
        </div>
      )}

      <div className="flex gap-2">
        <Pilihan
          nilai={pilih}
          onUbah={setPilih}
          placeholder={tersedia.length ? 'Pilih produk...' : 'Semua produk sudah dipakai'}
          daftar={tersedia.map((p) => ({
            nilai: p.id,
            label: `${p.nama} (stok ${p.stok})`,
          }))}
          className="flex-1"
        />
        <Button type="button" variant="garis" onClick={tambah} disabled={!tersedia.length}>
          <LuPlus /> Tambah
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Form tambah / ubah                                                */
/* ---------------------------------------------------------------- */
function FormBarang({ jalur, label, barang, punyaStok, punyaPenyusun, terbuka, onTutup }) {
  const klien = useQueryClient();
  const sedangUbah = Boolean(barang);

  const [isian, setIsian] = useState(
    barang
      ? {
          nama: barang.nama,
          harga: barang.harga,
          harga_diskon: barang.harga_diskon != null ? barang.harga_diskon : '',
          nama_diskon: barang.nama_diskon || '',
        }
      : KOSONG
  );
  const [dijualSatuan, setDijualSatuan] = useState(barang ? barang.dijual_satuan !== false : true);
  const [komponen, setKomponen] = useState(
    barang?.komponen?.map((k) => ({ produk_id: k.produk_id, jumlah: k.jumlah })) || []
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
      ...(punyaStok ? { dijual_satuan: dijualSatuan } : {}),
      ...(punyaPenyusun ? { komponen } : {}),
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
      klien.invalidateQueries({ queryKey: ['menu'] });
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
          punyaStok
            ? 'Stok tidak diisi di sini. Produk baru selalu mulai dari 0, lalu diisi di halaman Stok.'
            : 'Menu bisa berdiri sendiri, atau dibuat dari produk yang stoknya Anda catat.'
        }
      >
        <form onSubmit={kirim} className="space-y-4">
          <Kolom label={`Nama ${label}`} wajib>
            <Input
              autoFocus
              placeholder={
                punyaStok ? 'Contoh: Sambal Bawang 100g' : 'Contoh: Paket Mie + Air Mineral'
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

          {punyaStok && (
            <Saklar
              nyala={dijualSatuan}
              onUbah={setDijualSatuan}
              judul="Dijual satuan di kasir"
              keterangan="Kalau dimatikan, stoknya tetap dicatat tapi barangnya tidak muncul di layar kasir. Dipakai untuk bahan seperti mie instan yang hanya dijual di dalam menu."
            />
          )}

          {punyaPenyusun && <PemilihPenyusun komponen={komponen} setKomponen={setKomponen} />}

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

/* ---------------------------------------------------------------- */
/* Satu baris di daftar                                              */
/* ---------------------------------------------------------------- */
function BarisBarang({ barang, jalur, label, punyaStok, onUbah }) {
  const klien = useQueryClient();
  const diarsipkan = Boolean(barang.diarsipkan_pada);
  const tidakSatuan = punyaStok && barang.dijual_satuan === false;
  const Ikon = punyaStok ? LuPackage : LuUtensils;

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
      /* pesannya sudah muncul lewat toast */
    }
  }

  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border-2 border-netral-200 bg-white p-3',
        diarsipkan && 'opacity-60'
      )}
    >
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-xl',
          punyaStok ? 'bg-boom-50 text-boom-600' : 'bg-daun-50 text-daun-700'
        )}
      >
        <Ikon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-coklat-900">{barang.nama}</p>
          {diarsipkan && <Label warna="netral">Diarsipkan</Label>}
          {tidakSatuan && (
            <Label warna="kuning">
              <LuEyeOff className="size-3" /> Tidak dijual satuan
            </Label>
          )}
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
            Stok: {angka(barang.stok)}
          </p>
        )}

        {!punyaStok && barang.komponen?.length > 0 && (
          <div className="mt-1.5 rounded-lg bg-coklat-50 px-2.5 py-1.5">
            <p className="text-xs font-bold text-coklat-900">
              Dibuat dari stok
              {barang.sisa_porsi != null && (
                <span
                  className={cn(
                    'angka ml-1.5 font-extrabold',
                    barang.sisa_porsi <= 0
                      ? 'text-boom-600'
                      : barang.sisa_porsi <= 5
                        ? 'text-terakota-500'
                        : 'text-daun-700'
                  )}
                >
                  &middot; sisa {barang.sisa_porsi} porsi
                </span>
              )}
            </p>
            <p className="angka mt-0.5 text-xs text-coklat-600">
              {barang.komponen.map((k) => `${k.jumlah}x ${k.nama_produk}`).join(' + ')}
            </p>
            {barang.pembatas_porsi && barang.sisa_porsi <= 5 && (
              <p className="mt-0.5 text-xs font-semibold text-boom-600">
                Dibatasi oleh {barang.pembatas_porsi}
              </p>
            )}
          </div>
        )}

        {!punyaStok && !barang.komponen?.length && (
          <p className="mt-1 text-sm text-coklat-400">Tidak dibatasi stok</p>
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

/* ---------------------------------------------------------------- */
/* Halaman                                                           */
/* ---------------------------------------------------------------- */
export default function HalamanKatalog({ jalur, label, labelJamak, keterangan, punyaStok }) {
  const kunci = jalur.replace('/', '');
  const punyaPenyusun = !punyaStok;

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
  const tidakSatuan = (daftar.data || []).filter((b) => b.dijual_satuan === false).length;

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
          {tidakSatuan > 0 && (
            <>
              {' '}
              Saat ini ada <strong>{tidakSatuan} produk</strong> yang tidak dijual satuan — stoknya
              dicatat, tapi hanya dipakai sebagai penyusun menu.
            </>
          )}
        </Pemberitahuan>
      )}

      {punyaPenyusun && (
        <Pemberitahuan warna="netral" className="mb-4" ikon={LuInfo}>
          Menu boleh dibuat dari produk yang stoknya Anda catat. Saat menu terjual, stok
          penyusunnya ikut berkurang. Menu tanpa penyusun tetap boleh ada dan tidak menyentuh stok
          sama sekali.
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
          punyaStok={punyaStok}
          punyaPenyusun={punyaPenyusun}
          terbuka={formTerbuka}
          onTutup={() => setFormTerbuka(false)}
        />
      )}
    </div>
  );
}
