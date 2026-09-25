/**
 * Pembungkus penyimpanan peramban yang tidak pernah melempar galat.
 *
 * Kenapa perlu: di Safari mode Penyamaran, di sebagian peramban yang diatur
 * menolak penyimpanan situs, dan di beberapa peramban di dalam aplikasi lain
 * (misalnya membuka tautan langsung dari dalam WhatsApp), memanggil
 * localStorage bisa langsung melempar galat. Karena token masuk dibaca pada
 * SETIAP permintaan ke server, satu galat di situ akan mematikan seluruh
 * aplikasi, bukan cuma fitur mengingat sesinya.
 *
 * Kalau penyimpanan peramban tidak bisa dipakai, otomatis diganti penyimpanan
 * sementara di memori: kasir tetap bisa bekerja normal, hanya saja sesinya
 * hilang begitu tab ditutup.
 */
const cadangan = new Map();
let bisaDipakai = null;

function periksa() {
  if (bisaDipakai !== null) return bisaDipakai;
  try {
    const kunciUji = '__uji_boomboo__';
    window.localStorage.setItem(kunciUji, '1');
    window.localStorage.removeItem(kunciUji);
    bisaDipakai = true;
  } catch {
    bisaDipakai = false;
    if (typeof console !== 'undefined') {
      console.warn(
        '[Boomboo] Penyimpanan peramban tidak bisa dipakai. Sesi hanya bertahan selama tab ini terbuka.'
      );
    }
  }
  return bisaDipakai;
}

export const simpanan = {
  ambil(kunci) {
    if (periksa()) {
      try {
        return window.localStorage.getItem(kunci);
      } catch {
        /* jatuh ke cadangan di bawah */
      }
    }
    return cadangan.has(kunci) ? cadangan.get(kunci) : null;
  },

  simpan(kunci, nilai) {
    cadangan.set(kunci, nilai);
    if (!periksa()) return;
    try {
      window.localStorage.setItem(kunci, nilai);
    } catch {
      /* cukup tersimpan di memori */
    }
  },

  hapus(kunci) {
    cadangan.delete(kunci);
    if (!periksa()) return;
    try {
      window.localStorage.removeItem(kunci);
    } catch {
      /* tidak apa-apa */
    }
  },

  /** true kalau sesi bisa bertahan setelah tab ditutup. */
  awet: () => periksa(),
};
