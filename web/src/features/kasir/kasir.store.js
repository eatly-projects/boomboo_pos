import { useMemo } from 'react';
import { create } from 'zustand';

/**
 * Menghitung isi keranjang. Sengaja dibuat sebagai fungsi biasa di luar
 * store, BUKAN sebagai bagian dari state.
 *
 * Kalau penghitungan ini dipanggil langsung di dalam pembacaan state
 * (misalnya `useKeranjang((s) => s.hitung())`), hasilnya adalah objek baru
 * setiap kali komponen digambar ulang. React menganggap datanya selalu
 * berubah, lalu menggambar ulang lagi tanpa henti sampai layar jadi kosong.
 */
export function hitungKeranjang(item, diskonJenis, diskonNilai) {
  const subtotal = item.reduce((t, i) => t + i.harga_dipakai * i.jumlah, 0);

  let potongan = 0;
  if (diskonJenis && diskonNilai > 0) {
    potongan =
      diskonJenis === 'persen'
        ? Math.round((subtotal * diskonNilai) / 100)
        : Number(diskonNilai);
    if (potongan > subtotal) potongan = subtotal; // total tidak boleh minus
  }

  return {
    subtotal,
    potongan,
    total: subtotal - potongan,
    jumlahBarang: item.reduce((t, i) => t + i.jumlah, 0),
  };
}

/**
 * Keranjang kasir.
 *
 * Disimpan di memori saja. Kalau halaman ditutup, keranjang hilang - itu
 * disengaja, supaya tidak ada sisa keranjang orang lain yang tertinggal di
 * perangkat yang dipakai bergantian.
 */
export const useKeranjang = create((set, get) => ({
  item: [],
  diskon_jenis: null,
  diskon_nilai: null,

  tambah(barang, jenis) {
    const kunci = `${jenis}:${barang.id}`;
    const item = [...get().item];
    const adaDi = item.findIndex((i) => i.kunci === kunci);

    if (adaDi >= 0) {
      const sekarang = item[adaDi];
      // Produk dijaga tidak melebihi stok yang tersedia.
      if (jenis === 'produk' && sekarang.jumlah + 1 > barang.stok) return false;
      item[adaDi] = { ...sekarang, jumlah: sekarang.jumlah + 1 };
    } else {
      if (jenis === 'produk' && barang.stok < 1) return false;
      item.push({
        kunci,
        jenis_barang: jenis,
        barang_id: barang.id,
        nama: barang.nama,
        harga_normal: barang.harga,
        harga_diskon: barang.harga_diskon,
        nama_diskon: barang.nama_diskon,
        harga_dipakai: barang.harga_diskon ?? barang.harga,
        foto_url: barang.foto_url,
        stok: jenis === 'produk' ? barang.stok : null,
        jumlah: 1,
      });
    }
    set({ item });
    return true;
  },

  setJumlah(kunci, jumlah) {
    if (jumlah <= 0) return get().hapus(kunci);
    set({
      item: get().item.map((i) => {
        if (i.kunci !== kunci) return i;
        const batas = i.jenis_barang === 'produk' ? Math.min(jumlah, i.stok) : jumlah;
        return { ...i, jumlah: batas };
      }),
    });
  },

  hapus(kunci) {
    set({ item: get().item.filter((i) => i.kunci !== kunci) });
  },

  setDiskon(jenis, nilai) {
    set({ diskon_jenis: jenis, diskon_nilai: nilai });
  },

  kosongkan() {
    set({ item: [], diskon_jenis: null, diskon_nilai: null });
  },

  /** Bentuk data yang dikirim ke backend. Dipanggil saat tombol ditekan. */
  untukDikirim() {
    const { item, diskon_jenis, diskon_nilai } = get();
    return {
      item: item.map((i) => ({
        jenis_barang: i.jenis_barang,
        barang_id: i.barang_id,
        jumlah: i.jumlah,
      })),
      diskon_jenis: diskon_nilai > 0 ? diskon_jenis : null,
      diskon_nilai: diskon_nilai > 0 ? Number(diskon_nilai) : null,
    };
  },
}));

/**
 * Angka-angka keranjang untuk ditampilkan di layar.
 * Tiap bagian state dibaca terpisah supaya nilainya stabil, lalu hasil
 * hitungannya disimpan dengan useMemo.
 */
export function useHitunganKeranjang() {
  const item = useKeranjang((s) => s.item);
  const jenis = useKeranjang((s) => s.diskon_jenis);
  const nilai = useKeranjang((s) => s.diskon_nilai);
  return useMemo(() => hitungKeranjang(item, jenis, nilai), [item, jenis, nilai]);
}
