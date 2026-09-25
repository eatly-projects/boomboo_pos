import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuArrowRight } from 'react-icons/lu';
import { useAuth } from '../auth.store';
import BingkaiAuth from './BingkaiAuth.jsx';
import { Button } from '@/shared/components/ui/button';
import { Input, InputPassword, Kolom } from '@/shared/components/ui/input';

export default function Daftar() {
  const daftar = useAuth((s) => s.daftar);
  const navigate = useNavigate();

  const [isian, setIsian] = useState({
    nama: '',
    email: '',
    password: '',
    kode_pendaftaran: '',
  });
  const [sedangKirim, setSedangKirim] = useState(false);

  const ubah = (kolom) => (e) => setIsian((s) => ({ ...s, [kolom]: e.target.value }));

  async function kirim(e) {
    e.preventDefault();
    setSedangKirim(true);
    try {
      await daftar(isian);
      navigate('/kasir', { replace: true });
    } catch {
      // pesannya sudah dimunculkan lewat toast
    } finally {
      setSedangKirim(false);
    }
  }

  return (
    <BingkaiAuth
      judul="Daftar akun baru"
      keterangan="Isi data Anda untuk mulai memakai aplikasi kasir."
      bawah={
        <>
          Sudah punya akun?{' '}
          <Link to="/masuk" className="font-bold text-boom-600 hover:underline">
            Masuk di sini
          </Link>
        </>
      }
    >
      <form onSubmit={kirim} className="space-y-4">
        <Kolom label="Nama lengkap" wajib>
          <Input
            autoComplete="name"
            placeholder="Contoh: Sari Wulandari"
            value={isian.nama}
            onChange={ubah('nama')}
            required
            minLength={2}
          />
        </Kolom>

        <Kolom label="Email kantor" wajib>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nama@boomboo.id"
            value={isian.email}
            onChange={ubah('email')}
            required
          />
        </Kolom>

        <Kolom label="Kata sandi" wajib bantuan="Minimal 6 karakter.">
          <InputPassword
            autoComplete="new-password"
            placeholder="Buat kata sandi"
            value={isian.password}
            onChange={ubah('password')}
            required
            minLength={6}
          />
        </Kolom>

        <Kolom
          label="Kode pendaftaran"
          bantuan="Isi hanya kalau pengelola memberi Anda kode. Kalau tidak, kosongkan saja."
        >
          <Input
            placeholder="Kosongkan kalau tidak punya"
            value={isian.kode_pendaftaran}
            onChange={ubah('kode_pendaftaran')}
          />
        </Kolom>

        <Button type="submit" ukuran="besar" className="w-full" disabled={sedangKirim}>
          {sedangKirim ? 'Sedang membuat akun...' : 'Buat akun'}
          {!sedangKirim && <LuArrowRight />}
        </Button>
      </form>
    </BingkaiAuth>
  );
}
