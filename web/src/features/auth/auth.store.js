import { create } from 'zustand';
import { api, KUNCI_TOKEN, denganToast } from '@/shared/lib/api';
import { simpanan } from '@/shared/lib/simpanan';

/**
 * Menyimpan siapa yang sedang masuk.
 *
 * Catatan: untuk sekarang SEMUA user boleh melakukan semua hal (keputusan
 * K19). Peran tetap disimpan supaya nanti tinggal dipakai kalau pembatasan
 * hak akses mau diaktifkan.
 */
export const useAuth = create((set, get) => ({
  user: null,
  token: simpanan.ambil(KUNCI_TOKEN) || null,
  sedangMemeriksa: true,

  /** Dipanggil sekali saat aplikasi dibuka, untuk memastikan token masih sah. */
  async periksaSesi() {
    const token = simpanan.ambil(KUNCI_TOKEN);
    if (!token) return set({ user: null, token: null, sedangMemeriksa: false });

    try {
      const { data } = await api.get('/auth/saya');
      set({ user: data.data, token, sedangMemeriksa: false });
    } catch {
      simpanan.hapus(KUNCI_TOKEN);
      set({ user: null, token: null, sedangMemeriksa: false });
    }
  },

  async masuk(isian) {
    const hasil = await denganToast(() => api.post('/auth/masuk', isian), {
      memuat: 'Memeriksa akun Anda...',
      sukses: (d) => d.pesan,
    });
    simpanan.simpan(KUNCI_TOKEN, hasil.data.token);
    set({ user: hasil.data.user, token: hasil.data.token });
    return hasil.data.user;
  },

  async daftar(isian) {
    const hasil = await denganToast(() => api.post('/auth/daftar', isian), {
      memuat: 'Membuat akun...',
      sukses: (d) => d.pesan,
    });
    simpanan.simpan(KUNCI_TOKEN, hasil.data.token);
    set({ user: hasil.data.user, token: hasil.data.token });
    return hasil.data.user;
  },

  keluar() {
    simpanan.hapus(KUNCI_TOKEN);
    set({ user: null, token: null });
  },

  sudahMasuk: () => Boolean(get().token && get().user),
}));
