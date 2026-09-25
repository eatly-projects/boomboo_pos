import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LuArrowRight } from 'react-icons/lu';
import { useAuth } from '../auth.store';
import BingkaiAuth from './BingkaiAuth.jsx';
import { Button } from '@/shared/components/ui/button';
import { Input, InputPassword, Kolom } from '@/shared/components/ui/input';

export default function Masuk() {
  const masuk = useAuth((s) => s.masuk);
  const navigate = useNavigate();
  const lokasi = useLocation();

  const [isian, setIsian] = useState({ email: '', password: '' });
  const [sedangKirim, setSedangKirim] = useState(false);

  const ubah = (kolom) => (e) => setIsian((s) => ({ ...s, [kolom]: e.target.value }));

  async function kirim(e) {
    e.preventDefault();
    setSedangKirim(true);
    try {
      await masuk(isian);
      navigate(lokasi.state?.dari || '/kasir', { replace: true });
    } catch {
      // pesannya sudah dimunculkan lewat toast
    } finally {
      setSedangKirim(false);
    }
  }

  return (
    <BingkaiAuth
      judul="Masuk"
      keterangan="Gunakan email kantor dan kata sandi Anda."
      bawah={
        <>
          Belum punya akun?{' '}
          <Link to="/daftar" className="font-bold text-boom-600 hover:underline">
            Daftar di sini
          </Link>
        </>
      }
    >
      <form onSubmit={kirim} className="space-y-4">
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

        <Kolom label="Kata sandi" wajib>
          <InputPassword
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            value={isian.password}
            onChange={ubah('password')}
            required
          />
        </Kolom>

        <Button type="submit" ukuran="besar" className="w-full" disabled={sedangKirim}>
          {sedangKirim ? 'Sedang memeriksa...' : 'Masuk'}
          {!sedangKirim && <LuArrowRight />}
        </Button>
      </form>
    </BingkaiAuth>
  );
}
