import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LuPlus, LuPencil, LuUserX, LuUserCheck, LuUsers, LuInfo } from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { tanggalPanjang } from '@/shared/lib/format';
import { useAuth } from '@/features/auth/auth.store';
import { Button } from '@/shared/components/ui/button';
import { Input, InputPassword, Kolom } from '@/shared/components/ui/input';
import { Pilihan } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { KepalaHalaman, Kosong, Rangka, Label, Pemberitahuan } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

const PERAN = [
  { nilai: 'pemilik', label: 'Pemilik' },
  { nilai: 'manajer', label: 'Manajer' },
  { nilai: 'kasir', label: 'Kasir' },
];

function FormUser({ user, terbuka, onTutup }) {
  const klien = useQueryClient();
  const sedangUbah = Boolean(user);

  const [isian, setIsian] = useState({
    nama: user?.nama || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'kasir',
  });
  const [sedangKirim, setSedangKirim] = useState(false);

  const ubah = (k) => (e) => setIsian((s) => ({ ...s, [k]: e.target.value }));

  async function kirim(e) {
    e.preventDefault();
    if (!sedangUbah && isian.password.length < 6)
      return toast.error('Kata sandi minimal 6 karakter.');

    const data = {
      nama: isian.nama.trim(),
      email: isian.email.trim(),
      role: isian.role,
      ...(isian.password ? { password: isian.password } : {}),
    };

    setSedangKirim(true);
    try {
      await denganToast(
        () => (sedangUbah ? api.patch(`/user/${user.id}`, data) : api.post('/user', data)),
        { memuat: 'Menyimpan...', sukses: (d) => d.pesan }
      );
      klien.invalidateQueries({ queryKey: ['user'] });
      onTutup();
    } catch {
      setSedangKirim(false);
    }
  }

  return (
    <Dialog open={terbuka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent
        judul={sedangUbah ? 'Ubah User' : 'Tambah User Baru'}
        keterangan="Untuk sekarang semua user bisa melakukan semua hal. Peran hanya dicatat sebagai keterangan."
      >
        <form onSubmit={kirim} className="space-y-4">
          <Kolom label="Nama lengkap" wajib>
            <Input
              autoFocus
              placeholder="Contoh: Sari Wulandari"
              value={isian.nama}
              onChange={ubah('nama')}
              required
              minLength={2}
            />
          </Kolom>

          <Kolom label="Email kantor" wajib bantuan="Email ini dipakai untuk masuk ke aplikasi.">
            <Input
              type="email"
              placeholder="nama@boomboo.id"
              value={isian.email}
              onChange={ubah('email')}
              required
            />
          </Kolom>

          <Kolom
            label={sedangUbah ? 'Kata sandi baru' : 'Kata sandi'}
            wajib={!sedangUbah}
            bantuan={
              sedangUbah
                ? 'Kosongkan kalau kata sandinya tidak diganti.'
                : 'Minimal 6 karakter.'
            }
          >
            <InputPassword
              placeholder={sedangUbah ? 'Kosongkan kalau tidak diganti' : 'Buat kata sandi'}
              value={isian.password}
              onChange={ubah('password')}
              autoComplete="new-password"
            />
          </Kolom>

          <Kolom label="Peran">
            <Pilihan
              nilai={isian.role}
              onUbah={(v) => setIsian((s) => ({ ...s, role: v }))}
              daftar={PERAN}
            />
          </Kolom>

          <DialogFooter>
            <Button type="button" variant="garis" onClick={onTutup} disabled={sedangKirim}>
              Batal
            </Button>
            <Button type="submit" disabled={sedangKirim}>
              {sedangKirim ? 'Menyimpan...' : sedangUbah ? 'Simpan perubahan' : 'Tambah user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HalamanUser() {
  const klien = useQueryClient();
  const sayaSendiri = useAuth((s) => s.user);
  const [termasukArsip, setTermasukArsip] = useState(true);
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [yangDiubah, setYangDiubah] = useState(null);

  const data = useQuery({
    queryKey: ['user', { termasukArsip }],
    queryFn: () => ambil('/user', { params: { termasuk_arsip: termasukArsip } }),
  });

  const daftar = data.data || [];

  async function ubahAktif(u) {
    try {
      await denganToast(
        () =>
          u.diarsipkan_pada
            ? api.post(`/user/${u.id}/pulihkan`)
            : api.delete(`/user/${u.id}`),
        { memuat: 'Memproses...', sukses: (d) => d.pesan }
      );
      klien.invalidateQueries({ queryKey: ['user'] });
    } catch {
      // toast sudah muncul
    }
  }

  return (
    <div>
      <KepalaHalaman
        judul="User"
        keterangan="Orang-orang yang bisa masuk ke aplikasi kasir ini."
        aksi={
          <Button
            onClick={() => {
              setYangDiubah(null);
              setFormTerbuka(true);
            }}
          >
            <LuPlus /> Tambah User
          </Button>
        }
      />

      <Pemberitahuan warna="kuning" className="mb-4" ikon={LuInfo} judul="Hak akses belum dibatasi">
        Sesuai kesepakatan, untuk sekarang <strong>semua user bisa melakukan semua hal</strong>.
        Kolom peran sudah disiapkan, jadi pembatasan tinggal diaktifkan kapan saja nanti.
      </Pemberitahuan>

      {data.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Rangka key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong ikon={LuUsers} judul="Belum ada user" keterangan="Tambahkan user pertama." />
      ) : (
        <div className="space-y-2">
          {daftar.map((u) => {
            const nonaktif = Boolean(u.diarsipkan_pada);
            const iniSaya = u.id === sayaSendiri?.id;

            return (
              <div
                key={u.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-2xl border-2 border-netral-200 bg-white p-3',
                  nonaktif && 'opacity-60'
                )}
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-boom-500 font-bold text-white">
                  {u.nama.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-coklat-900">{u.nama}</p>
                    <Label warna="netral">
                      {PERAN.find((p) => p.nilai === u.role)?.label || u.role}
                    </Label>
                    {iniSaya && <Label warna="hijau">Anda</Label>}
                    {nonaktif && <Label warna="merah">Nonaktif</Label>}
                  </div>
                  <p className="truncate text-sm text-coklat-600">{u.email}</p>
                  <p className="text-xs text-coklat-400">
                    Dibuat {tanggalPanjang(u.dibuat_pada)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <Button
                    ukuran="kecil"
                    variant="garis"
                    onClick={() => {
                      setYangDiubah(u);
                      setFormTerbuka(true);
                    }}
                  >
                    <LuPencil /> Ubah
                  </Button>
                  {!iniSaya && (
                    <Button ukuran="kecil" variant="polos" onClick={() => ubahAktif(u)}>
                      {nonaktif ? (
                        <>
                          <LuUserCheck /> Aktifkan
                        </>
                      ) : (
                        <>
                          <LuUserX /> Nonaktifkan
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formTerbuka && (
        <FormUser
          key={yangDiubah?.id || 'baru'}
          user={yangDiubah}
          terbuka={formTerbuka}
          onTutup={() => setFormTerbuka(false)}
        />
      )}
    </div>
  );
}
