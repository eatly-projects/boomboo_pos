import axios from 'axios';
import toast from 'react-hot-toast';
import { simpanan } from './simpanan';

const ALAMAT = import.meta.env.VITE_API_URL || 'http://localhost:4100';

export const KUNCI_TOKEN = 'boomboo_token';

export const api = axios.create({
  baseURL: `${ALAMAT.replace(/\/$/, '')}/api`,
  timeout: 30000,
});

api.interceptors.request.use((konfig) => {
  const token = simpanan.ambil(KUNCI_TOKEN);
  if (token) konfig.headers.Authorization = `Bearer ${token}`;
  return konfig;
});

api.interceptors.response.use(
  (jawaban) => jawaban,
  (galat) => {
    const status = galat.response?.status;

    // Sesi habis: bersihkan dan kembalikan ke halaman masuk
    if (status === 401 && !galat.config?.url?.includes('/auth/masuk')) {
      simpanan.hapus(KUNCI_TOKEN);
      if (!location.pathname.startsWith('/masuk') && !location.pathname.startsWith('/struk/')) {
        location.href = '/masuk';
      }
    }
    return Promise.reject(galat);
  }
);

/** Mengambil pesan kesalahan yang sudah ramah dibaca dari backend. */
export function pesanGalat(galat, cadangan = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (galat?.response?.data?.pesan) return galat.response.data.pesan;
  if (galat?.code === 'ECONNABORTED') return 'Sambungan terlalu lama. Periksa internet Anda.';
  if (galat?.message === 'Network Error')
    return 'Tidak bisa menghubungi server. Periksa sambungan internet.';
  return galat?.message || cadangan;
}

/**
 * Pembungkus supaya SETIAP permintaan ke backend selalu memunculkan toast,
 * sesuai aturan tampilan yang dipakai di project ini.
 *
 *   await denganToast(() => api.post('/produk', data), {
 *     memuat: 'Menyimpan produk...',
 *     sukses: (d) => d.pesan,
 *   })
 */
export async function denganToast(kerjakan, { memuat = 'Memproses...', sukses } = {}) {
  const id = toast.loading(memuat);
  try {
    const { data } = await kerjakan();
    const pesan =
      typeof sukses === 'function' ? sukses(data) : sukses || data?.pesan || 'Berhasil.';
    toast.success(pesan, { id });
    return data;
  } catch (galat) {
    toast.error(pesanGalat(galat), { id });
    throw galat;
  }
}

/** Ambil data biasa (tanpa toast), dipakai TanStack Query. */
export const ambil = (url, konfig) => api.get(url, konfig).then((r) => r.data.data);
