import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LuCalculator, LuLayoutDashboard, LuPackage, LuUtensils, LuBoxes,
  LuReceipt, LuSend, LuImage, LuHistory, LuUsers, LuSettings,
  LuMenu, LuX, LuLogOut, LuPhone, LuChevronRight,
} from 'react-icons/lu';
import { useAuth } from '@/features/auth/auth.store';
import LogoBoomboo from '@/shared/components/LogoBoomboo.jsx';
import { cn } from '@/shared/lib/utils';

const MENU_UTAMA = [
  { ke: '/kasir', label: 'Kasir', ikon: LuCalculator },
  { ke: '/dashboard', label: 'Dashboard', ikon: LuLayoutDashboard },
  { ke: '/transaksi', label: 'Transaksi', ikon: LuReceipt },
  { ke: '/stok', label: 'Stok', ikon: LuBoxes },
];

const MENU_KATALOG = [
  { ke: '/produk', label: 'Produk', ikon: LuPackage },
  { ke: '/menu', label: 'Menu Makan', ikon: LuUtensils },
];

const MENU_STRUK = [
  { ke: '/antrian-struk', label: 'Antrian Kirim Struk', ikon: LuSend },
  { ke: '/kontak', label: 'Kontak WhatsApp', ikon: LuPhone },
];

const MENU_LAIN = [
  { ke: '/media', label: 'Media Bukti Bayar', ikon: LuImage },
  { ke: '/log', label: 'Log Aktivitas', ikon: LuHistory },
  { ke: '/user', label: 'User', ikon: LuUsers },
  { ke: '/pengaturan', label: 'Pengaturan', ikon: LuSettings },
];

const SEMUA_KELOMPOK = [
  { judul: null, isi: MENU_UTAMA },
  { judul: 'Katalog', isi: MENU_KATALOG },
  { judul: 'Struk', isi: MENU_STRUK },
  { judul: 'Lainnya', isi: MENU_LAIN },
];

function TautanMenu({ ke, label, ikon: Ikon, onKlik }) {
  return (
    <NavLink
      to={ke}
      onClick={onKlik}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
          isActive
            ? 'bg-boom-500 text-white'
            : 'text-coklat-600 hover:bg-coklat-50 hover:text-coklat-900'
        )
      }
    >
      <Ikon className="size-4.5 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function IsiSidebar({ onKlik }) {
  const { user, keluar } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b-2 border-netral-200 px-4">
        <LogoBoomboo className="h-7 self-center" />
        <span className="ml-2.5 rounded-lg bg-coklat-50 px-2 py-0.5 text-xs font-bold text-coklat-600">
          Kasir
        </span>
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {SEMUA_KELOMPOK.map((kelompok, i) => (
          <div key={i} className="space-y-1">
            {kelompok.judul && (
              <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-coklat-400">
                {kelompok.judul}
              </p>
            )}
            {kelompok.isi.map((m) => (
              <TautanMenu key={m.ke} {...m} onKlik={onKlik} />
            ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t-2 border-netral-200 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-coklat-50 px-3 py-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-boom-500 text-sm font-bold text-white">
            {user?.nama?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-coklat-900">{user?.nama}</p>
            <p className="truncate text-xs capitalize text-coklat-400">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => {
            keluar();
            navigate('/masuk');
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-coklat-600 transition-colors hover:bg-boom-50 hover:text-boom-600"
        >
          <LuLogOut className="size-4.5" />
          Keluar
        </button>
      </div>
    </div>
  );
}

export default function Cangkang() {
  const [laciTerbuka, setLaciTerbuka] = useState(false);
  const lokasi = useLocation();

  const judulHalaman =
    SEMUA_KELOMPOK.flatMap((k) => k.isi).find((m) => lokasi.pathname.startsWith(m.ke))?.label ||
    'Boomboo';

  return (
    <div className="min-h-dvh bg-netral-100">
      {/* Sidebar layar lebar: menempel, setinggi layar, tidak ikut memanjang
          walaupun isi halamannya panjang. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r-2 border-netral-200 bg-white lg:block">
        <IsiSidebar />
      </aside>

      {/* Laci untuk layar kecil */}
      {laciTerbuka && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Tutup menu"
            onClick={() => setLaciTerbuka(false)}
            className="absolute inset-0 bg-coklat-900/40 backdrop-blur-[2px]"
          />
          <aside className="animasi-naik absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <button
              aria-label="Tutup menu"
              onClick={() => setLaciTerbuka(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-2 text-coklat-400 hover:bg-coklat-50"
            >
              <LuX className="size-5" />
            </button>
            <IsiSidebar onKlik={() => setLaciTerbuka(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Bilah atas untuk layar kecil */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b-2 border-netral-200 bg-white px-3 lg:hidden">
          <button
            aria-label="Buka menu"
            onClick={() => setLaciTerbuka(true)}
            className="rounded-lg p-2 text-coklat-600 hover:bg-coklat-50"
          >
            <LuMenu className="size-5" />
          </button>
          <LogoBoomboo className="h-6 self-center" />
          <LuChevronRight className="size-4 text-netral-300" />
          <span className="truncate text-sm font-bold text-coklat-900">{judulHalaman}</span>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
