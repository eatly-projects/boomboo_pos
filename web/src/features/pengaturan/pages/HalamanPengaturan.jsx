import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LuQrCode, LuUpload, LuTrash2, LuSave, LuShieldCheck, LuTriangleAlert } from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { Button } from '@/shared/components/ui/button';
import { Input, InputPassword, Kolom, Textarea } from '@/shared/components/ui/input';
import { KepalaHalaman, Rangka, Pemberitahuan } from '@/shared/components/ui/tampilan';

export default function HalamanPengaturan() {
  const klien = useQueryClient();
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [sedangSimpan, setSedangSimpan] = useState(null);

  const data = useQuery({ queryKey: ['pengaturan'], queryFn: () => ambil('/pengaturan') });

  const [isian, setIsian] = useState({
    nama_toko: '',
    teks_struk_bawah: '',
    kode_pendaftaran: '',
  });

  useEffect(() => {
    if (data.data) {
      setIsian({
        nama_toko: data.data.nama_toko || '',
        teks_struk_bawah: data.data.teks_struk_bawah || '',
        kode_pendaftaran: data.data.kode_pendaftaran || '',
      });
    }
  }, [data.data]);

  async function simpan(kunci) {
    setSedangSimpan(kunci);
    try {
      await denganToast(() => api.put(`/pengaturan/${kunci}`, { nilai: isian[kunci] }), {
        memuat: 'Menyimpan...',
        sukses: (d) => d.pesan,
      });
      klien.invalidateQueries({ queryKey: ['pengaturan'] });
    } catch {
      // toast sudah muncul
    } finally {
      setSedangSimpan(null);
    }
  }

  async function unggahQris(e) {
    const berkas = e.target.files?.[0];
    if (!berkas) return;
    const isi = new FormData();
    isi.append('gambar', berkas);

    setSedangUnggah(true);
    try {
      await denganToast(() => api.post('/pengaturan/qris', isi), {
        memuat: 'Mengunggah gambar QRIS...',
        sukses: (d) => d.pesan,
      });
      klien.invalidateQueries({ queryKey: ['pengaturan'] });
    } catch {
      // toast sudah muncul
    } finally {
      setSedangUnggah(false);
      e.target.value = '';
    }
  }

  async function hapusQris() {
    try {
      await denganToast(() => api.delete('/pengaturan/qris'), {
        memuat: 'Menghapus...',
        sukses: (d) => d.pesan,
      });
      klien.invalidateQueries({ queryKey: ['pengaturan'] });
    } catch {
      // toast sudah muncul
    }
  }

  const qris = data.data?.qris_gambar_url;

  return (
    <div className="mx-auto max-w-3xl">
      <KepalaHalaman
        judul="Pengaturan"
        keterangan="Pengaturan yang dipakai bersama oleh semua perangkat kasir."
      />

      {/* Gambar QRIS */}
      <div className="mb-4 rounded-2xl border-2 border-netral-200 bg-white p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <LuQrCode className="size-5 text-boom-500" />
          <p className="font-bold text-coklat-900">Gambar QRIS</p>
        </div>
        <p className="mb-4 text-sm text-coklat-400">
          Gambar ini yang muncul di layar pembayaran, di semua perangkat kasir sekaligus.
        </p>

        {data.isLoading ? (
          <Rangka className="aspect-square w-full max-w-xs rounded-xl" />
        ) : qris ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <img
              src={qris}
              alt="Gambar QRIS Boomboo"
              className="w-full max-w-[220px] rounded-xl border-2 border-netral-200"
            />
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex">
                <Button asChild variant="garis" disabled={sedangUnggah}>
                  <span>
                    <LuUpload /> {sedangUnggah ? 'Mengunggah...' : 'Ganti gambar'}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={unggahQris}
                  disabled={sedangUnggah}
                />
              </label>
              <Button variant="bahaya" onClick={hapusQris}>
                <LuTrash2 /> Hapus
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Pemberitahuan warna="kuning" className="mb-3" ikon={LuTriangleAlert}>
              Gambar QRIS belum diunggah. Sampai gambarnya ada, layar pembayaran hanya
              menampilkan totalnya saja, dan pembeli harus memindai QRIS yang ditempel di meja.
            </Pemberitahuan>

            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-netral-300 px-6 py-8 text-center transition-colors hover:border-boom-500">
              <LuUpload className="size-8 text-coklat-400" />
              <p className="font-bold text-coklat-900">
                {sedangUnggah ? 'Sedang mengunggah...' : 'Unggah gambar QRIS'}
              </p>
              <p className="text-sm text-coklat-400">Format JPG, PNG, atau WEBP. Maksimal 8 MB.</p>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={unggahQris}
                disabled={sedangUnggah}
              />
            </label>
          </>
        )}
      </div>

      {/* Nama toko & teks struk */}
      <div className="mb-4 space-y-5 rounded-2xl border-2 border-netral-200 bg-white p-4 sm:p-5">
        <p className="font-bold text-coklat-900">Tampilan struk</p>

        <Kolom label="Nama toko" bantuan="Muncul di halaman struk yang dibuka pembeli.">
          <div className="flex gap-2">
            <Input
              value={isian.nama_toko}
              onChange={(e) => setIsian((s) => ({ ...s, nama_toko: e.target.value }))}
              placeholder="Boomboo"
            />
            <Button
              onClick={() => simpan('nama_toko')}
              disabled={sedangSimpan === 'nama_toko'}
            >
              <LuSave /> Simpan
            </Button>
          </div>
        </Kolom>

        <Kolom
          label="Kalimat penutup di struk"
          bantuan="Kalimat ramah yang muncul di bagian bawah struk pembeli."
        >
          <Textarea
            rows={2}
            value={isian.teks_struk_bawah}
            onChange={(e) => setIsian((s) => ({ ...s, teks_struk_bawah: e.target.value }))}
            placeholder="Gurih, nagih. Terima kasih sudah belanja di Boomboo!"
          />
          <Button
            className="mt-2"
            onClick={() => simpan('teks_struk_bawah')}
            disabled={sedangSimpan === 'teks_struk_bawah'}
          >
            <LuSave /> Simpan kalimat penutup
          </Button>
        </Kolom>
      </div>

      {/* Kode pendaftaran */}
      <div className="rounded-2xl border-2 border-netral-200 bg-white p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <LuShieldCheck className="size-5 text-daun-500" />
          <p className="font-bold text-coklat-900">Kode pendaftaran</p>
        </div>
        <p className="mb-4 text-sm text-coklat-400">
          Kalau kolom ini diisi, orang yang mau mendaftar akun baru harus tahu kodenya.
          Kalau dikosongkan, halaman pendaftaran terbuka untuk siapa saja yang menemukan
          alamat aplikasi ini.
        </p>

        <Kolom
          label="Kode"
          bantuan="Bagikan kode ini hanya ke tim Anda. Kosongkan untuk membuka pendaftaran bebas."
        >
          <div className="flex gap-2">
            <InputPassword
              value={isian.kode_pendaftaran}
              onChange={(e) => setIsian((s) => ({ ...s, kode_pendaftaran: e.target.value }))}
              placeholder="Kosongkan kalau tidak dipakai"
              autoComplete="off"
            />
            <Button
              onClick={() => simpan('kode_pendaftaran')}
              disabled={sedangSimpan === 'kode_pendaftaran'}
            >
              <LuSave /> Simpan
            </Button>
          </div>
        </Kolom>
      </div>
    </div>
  );
}
