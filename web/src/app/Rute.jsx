import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth.store';
import Cangkang from './Cangkang.jsx';
import LayarMemuat from './LayarMemuat.jsx';

// Halaman yang dipakai terus-menerus saat berjualan dimuat langsung,
// supaya kasir tidak pernah menunggu walaupun sinyal di lokasi jelek.
import Masuk from '@/features/auth/pages/Masuk.jsx';
import Kasir from '@/features/kasir/pages/Kasir.jsx';
import Pembayaran from '@/features/kasir/pages/Pembayaran.jsx';

// Halaman yang lebih jarang dibuka diambil belakangan, supaya berkas
// yang harus diunduh pertama kali jauh lebih kecil.
const Daftar = lazy(() => import('@/features/auth/pages/Daftar.jsx'));
const Dashboard = lazy(() => import('@/features/dashboard/pages/Dashboard.jsx'));
const HalamanProduk = lazy(() => import('@/features/produk/pages/HalamanProduk.jsx'));
const HalamanMenu = lazy(() => import('@/features/menu/pages/HalamanMenu.jsx'));
const HalamanStok = lazy(() => import('@/features/stok/pages/HalamanStok.jsx'));
const KartuStok = lazy(() => import('@/features/stok/pages/KartuStok.jsx'));
const StokOpname = lazy(() => import('@/features/stok/pages/StokOpname.jsx'));
const HalamanTransaksi = lazy(() => import('@/features/transaksi/pages/HalamanTransaksi.jsx'));
const DetailTransaksi = lazy(() => import('@/features/transaksi/pages/DetailTransaksi.jsx'));
const AntrianStruk = lazy(() => import('@/features/struk/pages/AntrianStruk.jsx'));
const StrukPublik = lazy(() => import('@/features/struk/pages/StrukPublik.jsx'));
const KontakWhatsapp = lazy(() => import('@/features/struk/pages/KontakWhatsapp.jsx'));
const HalamanMedia = lazy(() => import('@/features/media/pages/HalamanMedia.jsx'));
const HalamanLog = lazy(() => import('@/features/log/pages/HalamanLog.jsx'));
const HalamanUser = lazy(() => import('@/features/user/pages/HalamanUser.jsx'));
const HalamanPengaturan = lazy(() => import('@/features/pengaturan/pages/HalamanPengaturan.jsx'));

function Terlindungi({ children }) {
  const { token, user, sedangMemeriksa } = useAuth();
  const lokasi = useLocation();

  if (sedangMemeriksa) return <LayarMemuat />;
  if (!token || !user) return <Navigate to="/masuk" state={{ dari: lokasi.pathname }} replace />;
  return children;
}

function HanyaTamu({ children }) {
  const { token, user, sedangMemeriksa } = useAuth();
  if (sedangMemeriksa) return <LayarMemuat />;
  if (token && user) return <Navigate to="/kasir" replace />;
  return children;
}

export default function Rute() {
  return (
    <Suspense fallback={<LayarMemuat pesan="Membuka halaman..." />}>
      <IsiRute />
    </Suspense>
  );
}

function IsiRute() {
  return (
    <Routes>
      {/* Halaman struk bisa dibuka siapa saja tanpa masuk, karena linknya
          dikirim ke pembeli lewat WhatsApp. */}
      <Route path="/struk/:kode" element={<StrukPublik />} />

      <Route path="/masuk" element={<HanyaTamu><Masuk /></HanyaTamu>} />
      <Route path="/daftar" element={<HanyaTamu><Daftar /></HanyaTamu>} />

      <Route element={<Terlindungi><Cangkang /></Terlindungi>}>
        <Route path="/" element={<Navigate to="/kasir" replace />} />
        <Route path="/kasir" element={<Kasir />} />
        <Route path="/kasir/bayar/:id" element={<Pembayaran />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/produk" element={<HalamanProduk />} />
        <Route path="/menu" element={<HalamanMenu />} />
        <Route path="/stok" element={<HalamanStok />} />
        <Route path="/stok/opname" element={<StokOpname />} />
        <Route path="/stok/:id" element={<KartuStok />} />
        <Route path="/transaksi" element={<HalamanTransaksi />} />
        <Route path="/transaksi/:id" element={<DetailTransaksi />} />
        <Route path="/antrian-struk" element={<AntrianStruk />} />
        <Route path="/kontak" element={<KontakWhatsapp />} />
        <Route path="/media" element={<HalamanMedia />} />
        <Route path="/log" element={<HalamanLog />} />
        <Route path="/user" element={<HalamanUser />} />
        <Route path="/pengaturan" element={<HalamanPengaturan />} />
      </Route>

      <Route path="*" element={<Navigate to="/kasir" replace />} />
    </Routes>
  );
}
