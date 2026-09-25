import LogoBoomboo from '@/shared/components/LogoBoomboo.jsx';

/** Ditampilkan saat aplikasi sedang memeriksa sesi. Tidak pernah layar kosong. */
export default function LayarMemuat({ pesan = 'Menyiapkan aplikasi...' }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-white px-6">
      <div className="flex flex-col items-center gap-5">
        <LogoBoomboo className="h-10 w-auto animate-pulse text-boom-500" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-netral-200">
          <div className="h-full w-1/2 animate-[geser_1.1s_ease-in-out_infinite] rounded-full bg-boom-500" />
        </div>
        <p className="text-sm text-coklat-400">{pesan}</p>
      </div>
      <style>{`@keyframes geser{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
    </div>
  );
}
