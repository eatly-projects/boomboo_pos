import ExcelJS from 'exceljs';
import { rupiah } from '../../shared/utils/bantu.js';

/**
 * Menyusun berkas Excel dari data laporan.
 *
 * Aturan tampilannya mengikuti aturan layar: tanpa singkatan, angka tidak
 * dipotong, dan tanggal ditulis lengkap. Kolom uang memakai format angka
 * Excel yang sesungguhnya (bukan teks), supaya tetap bisa dijumlah sendiri
 * oleh orang yang membukanya.
 */

const MERAH = 'FFE02B20';   // boom-500, warna merek Boomboo
const KRIM = 'FFFBF5EC';
const ABU = 'FFF2F0ED';
const GELAP = 'FF2B2017';

const UANG = '#,##0;[Red]-#,##0';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const tanggalLengkap = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return `${NAMA_HARI[d.getDay()]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

export const judulRentang = (dari, sampai) => {
  if (!dari) return 'Seluruh waktu';
  if (dari === sampai) return tanggalLengkap(dari);
  return `${tanggalLengkap(dari)} sampai ${tanggalLengkap(sampai)}`;
};

const jamMenit = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
};

const tanggalJam = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}, ${jamMenit(iso)}`;
};

/** Baris judul besar berwarna merek, dipakai di tiap lembar. */
function kepalaLembar(ws, judul, keterangan, lebarKolom) {
  ws.mergeCells(1, 1, 1, lebarKolom);
  const a = ws.getCell(1, 1);
  a.value = judul;
  a.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MERAH } };
  a.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, lebarKolom);
  const b = ws.getCell(2, 1);
  b.value = keterangan;
  b.font = { name: 'Calibri', size: 10, color: { argb: GELAP } };
  b.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KRIM } };
  b.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  ws.getRow(3).height = 6;
}

/** Baris nama kolom tabel. */
function kepalaTabel(ws, baris, kolom) {
  const r = ws.getRow(baris);
  kolom.forEach((k, i) => {
    const sel = r.getCell(i + 1);
    sel.value = k;
    sel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: GELAP } };
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ABU } };
    sel.alignment = { vertical: 'middle', wrapText: true };
    sel.border = { bottom: { style: 'thin', color: { argb: 'FFD8D4CF' } } };
  });
  r.height = 22;
  ws.views = [{ state: 'frozen', ySplit: baris }];
}

function barisTotal(ws, baris, kolom) {
  const r = ws.getRow(baris);
  kolom.forEach((v, i) => {
    const sel = r.getCell(i + 1);
    sel.value = v;
    sel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: GELAP } };
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KRIM } };
    sel.border = { top: { style: 'medium', color: { argb: MERAH } } };
    if (typeof v === 'number') sel.numFmt = UANG;
  });
  r.height = 20;
}

export async function buatExcel(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aplikasi Kasir Boomboo';
  wb.created = new Date();

  const rentang = judulRentang(data.tanggal_dari, data.tanggal_sampai);
  const dicetak = `Dicetak ${tanggalJam(data.dibuat_pada)}`;
  const r = data.ringkasan;

  /* ---------------- 1. Ringkasan ---------------- */
  const ws = wb.addWorksheet('Ringkasan', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });
  ws.columns = [{ width: 38 }, { width: 22 }, { width: 40 }];
  kepalaLembar(ws, 'LAPORAN PENJUALAN BOOMBOO', `${rentang}  ·  ${dicetak}`, 3);

  const angka = [
    ['Uang masuk', r.total_uang_masuk, 'Uang yang benar-benar diterima'],
    ['Jumlah transaksi berhasil', r.jumlah_transaksi, null],
    ['Rata-rata per transaksi', r.rata_rata_per_transaksi, null],
    ['Nilai belanja sebelum diskon', r.total_sebelum_diskon, null],
    ['Total diskon diberikan', r.total_diskon, null],
    [null, null, null],
    ['Transaksi dibatalkan', r.jumlah_batal, 'Tidak dihitung sebagai uang masuk'],
    ['Transaksi yang barangnya ditukar', r.jumlah_ditukar, null],
    ['Transaksi hasil penukaran', r.jumlah_hasil_tukar, 'Hanya mencatat selisih uangnya'],
    ['Transaksi dari Open Bill', r.jumlah_dari_bill, null],
    ['Transaksi dengan stok kurang', r.transaksi_stok_kurang, 'Perlu diperiksa stok fisiknya'],
  ];

  let b = 4;
  for (const [nama, nilai, catatan] of angka) {
    if (nama === null) { b++; continue; }
    const row = ws.getRow(b);
    row.getCell(1).value = nama;
    row.getCell(1).font = { name: 'Calibri', size: 11 };
    const sel = row.getCell(2);
    sel.value = nilai;
    sel.numFmt = nama.startsWith('Jumlah') || nama.startsWith('Transaksi') ? '#,##0' : UANG;
    sel.font = { name: 'Calibri', size: 11, bold: true };
    sel.alignment = { horizontal: 'right' };
    if (catatan) {
      row.getCell(3).value = catatan;
      row.getCell(3).font = { name: 'Calibri', size: 9, color: { argb: 'FF8A8178' }, italic: true };
    }
    row.height = 19;
    b++;
  }

  // Uang masuk ditegaskan sekali lagi, karena itu angka yang paling dicari
  ws.getRow(4).getCell(2).font = { name: 'Calibri', size: 13, bold: true, color: { argb: MERAH } };

  /* ---------------- 2. Barang terjual ---------------- */
  if (data.terlaris.length) {
    const w = wb.addWorksheet('Barang Terjual', {
      pageSetup: { paperSize: 9, fitToPage: true, fitToWidth: 1 },
    });
    w.columns = [{ width: 44 }, { width: 14 }, { width: 16 }, { width: 18 }];
    kepalaLembar(w, 'BARANG TERJUAL', `${rentang}  ·  urut dari yang paling laku`, 4);
    kepalaTabel(w, 4, ['Nama barang', 'Jenis', 'Jumlah terjual', 'Nilai penjualan']);

    let i = 5;
    for (const t of data.terlaris) {
      const row = w.getRow(i++);
      row.getCell(1).value = t.nama_barang;
      row.getCell(2).value = t.jenis_barang === 'menu' ? 'Menu makan' : 'Produk';
      row.getCell(3).value = t.jumlah_terjual;
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).value = t.total_penjualan;
      row.getCell(4).numFmt = UANG;
    }
    barisTotal(w, i, [
      'TOTAL',
      '',
      data.terlaris.reduce((a, t) => a + t.jumlah_terjual, 0),
      data.terlaris.reduce((a, t) => a + t.total_penjualan, 0),
    ]);
  }

  /* ---------------- 3. Per kasir ---------------- */
  if (data.per_kasir.length) {
    const w = wb.addWorksheet('Per Kasir', { pageSetup: { paperSize: 9, fitToPage: true } });
    w.columns = [{ width: 30 }, { width: 18 }, { width: 18 }, { width: 18 }];
    kepalaLembar(w, 'PENJUALAN PER KASIR', rentang, 4);
    kepalaTabel(w, 4, ['Nama kasir', 'Jumlah transaksi', 'Uang masuk', 'Diskon diberikan']);

    let i = 5;
    for (const k of data.per_kasir) {
      const row = w.getRow(i++);
      row.getCell(1).value = k.nama_kasir;
      row.getCell(2).value = k.jumlah_transaksi;
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).value = k.total;
      row.getCell(3).numFmt = UANG;
      row.getCell(4).value = k.total_diskon;
      row.getCell(4).numFmt = UANG;
    }
    barisTotal(w, i, [
      'TOTAL',
      data.per_kasir.reduce((a, k) => a + k.jumlah_transaksi, 0),
      data.per_kasir.reduce((a, k) => a + k.total, 0),
      data.per_kasir.reduce((a, k) => a + k.total_diskon, 0),
    ]);
  }

  /* ---------------- 4. Per jam ---------------- */
  if (data.per_jam.length) {
    const w = wb.addWorksheet('Per Jam', { pageSetup: { paperSize: 9, fitToPage: true } });
    w.columns = [{ width: 18 }, { width: 18 }, { width: 18 }];
    kepalaLembar(w, 'RAMAI PER JAM', `${rentang}  ·  waktu Jakarta`, 3);
    kepalaTabel(w, 4, ['Jam', 'Jumlah transaksi', 'Uang masuk']);

    let i = 5;
    for (const j of data.per_jam) {
      const row = w.getRow(i++);
      row.getCell(1).value = `${String(j.jam).padStart(2, '0')}.00 - ${String(j.jam).padStart(2, '0')}.59`;
      row.getCell(2).value = j.jumlah_transaksi;
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).value = j.total;
      row.getCell(3).numFmt = UANG;
    }
  }

  /* ---------------- 5. Barang keluar bukan jualan ---------------- */
  if (data.stok_keluar.per_alasan.length) {
    const w = wb.addWorksheet('Barang Keluar', { pageSetup: { paperSize: 9, fitToPage: true } });
    w.columns = [{ width: 28 }, { width: 18 }, { width: 22 }];
    kepalaLembar(
      w,
      'BARANG KELUAR BUKAN KARENA DIJUAL',
      `${rentang}  ·  nilainya memakai harga jual, bukan harga modal`,
      3
    );
    kepalaTabel(w, 4, ['Alasan', 'Jumlah barang', 'Nilai harga jual']);

    let i = 5;
    for (const s of data.stok_keluar.per_alasan) {
      const row = w.getRow(i++);
      row.getCell(1).value = s.alasan;
      row.getCell(2).value = s.jumlah_barang;
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).value = s.nilai;
      row.getCell(3).numFmt = UANG;
    }
    barisTotal(w, i, ['TOTAL', '', data.stok_keluar.total_nilai]);
    i += 2;
    w.getCell(i, 1).value = 'Sengaja dikeluarkan (sample, karyawan, hadiah)';
    w.getCell(i, 3).value = data.stok_keluar.nilai_sengaja_dikeluarkan;
    w.getCell(i, 3).numFmt = UANG;
    w.getCell(i + 1, 1).value = 'Karena rusak, tumpah, atau hilang';
    w.getCell(i + 1, 3).value = data.stok_keluar.nilai_kerusakan;
    w.getCell(i + 1, 3).numFmt = UANG;

    /* Rincian per baris. Angka ringkas di atas bisa menyesatkan kalau
       catatannya tidak ikut terbaca - sebuah baris beralasan "rusak" bisa
       saja sebenarnya pembetulan salah ketik. */
    i += 3;
    const peringatan = w.getCell(i, 1);
    w.mergeCells(i, 1, i, 7);
    peringatan.value =
      'Rincian tiap baris. Baca kolom catatannya sebelum menyimpulkan ini kerugian - ' +
      'sebagian bisa jadi pembetulan salah hitung, bukan barang yang benar-benar hilang.';
    peringatan.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF8A8178' } };
    peringatan.alignment = { wrapText: true, vertical: 'middle' };
    w.getRow(i).height = 24;

    i += 1;
    w.getColumn(4).width = 16;
    w.getColumn(5).width = 20;
    w.getColumn(6).width = 38;
    w.getColumn(7).width = 20;
    kepalaTabel(w, i, ['Waktu', 'Jumlah', 'Nilai harga jual', 'Nama barang', 'Alasan', 'Catatan', 'Dicatat oleh']);
    w.views = [{ state: 'frozen', ySplit: 4 }];

    i += 1;
    for (const d of data.stok_keluar.rincian) {
      const row = w.getRow(i++);
      row.getCell(1).value = tanggalJam(d.dibuat_pada);
      row.getCell(2).value = d.jumlah;
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).value = d.nilai;
      row.getCell(3).numFmt = UANG;
      row.getCell(4).value = d.nama_produk;
      row.getCell(5).value = d.alasan;
      row.getCell(6).value = d.catatan || '-';
      row.getCell(7).value = d.nama_user || '-';
      if (d.catatan) {
        row.getCell(6).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB36B00' } };
      }
    }
  }

  /* ---------------- 6. Daftar transaksi ---------------- */
  const w = wb.addWorksheet('Daftar Transaksi', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });
  w.columns = [
    { width: 20 }, { width: 10 }, { width: 22 }, { width: 22 },
    { width: 12 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 18 },
  ];
  kepalaLembar(w, 'DAFTAR SELURUH TRANSAKSI', `${rentang}  ·  ${data.transaksi.length} transaksi`, 9);
  kepalaTabel(w, 4, [
    'Nomor transaksi', 'Jam', 'Kasir', 'Pembeli',
    'Jenis barang', 'Jumlah barang', 'Diskon', 'Nilai belanja', 'Uang masuk',
  ]);

  let i = 5;
  for (const t of data.transaksi) {
    const row = w.getRow(i++);
    row.getCell(1).value = t.nomor;
    row.getCell(2).value = jamMenit(t.dikonfirmasi_pada);
    row.getCell(3).value = t.nama_kasir;
    row.getCell(4).value = t.nama_pembeli || '-';
    row.getCell(5).value = t.jumlah_baris;
    row.getCell(6).value = t.jumlah_barang;
    row.getCell(7).value = t.diskon_rupiah;
    row.getCell(7).numFmt = UANG;
    row.getCell(8).value = t.total;
    row.getCell(8).numFmt = UANG;
    row.getCell(9).value = t.uang_masuk;
    row.getCell(9).numFmt = UANG;
    if (t.hasil_tukar) {
      row.getCell(1).note = 'Transaksi pengganti dari penukaran barang. Yang tercatat hanya selisih uangnya.';
      row.getCell(1).font = { name: 'Calibri', size: 11, color: { argb: 'FF1E6FD9' } };
    }
    if (t.status === 'ditukar') {
      row.getCell(1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF8A8178' } };
    }
  }
  barisTotal(w, i, [
    'TOTAL', '', '', '', '',
    data.transaksi.reduce((a, t) => a + t.jumlah_barang, 0),
    data.transaksi.reduce((a, t) => a + t.diskon_rupiah, 0),
    data.transaksi.reduce((a, t) => a + t.total, 0),
    data.transaksi.reduce((a, t) => a + t.uang_masuk, 0),
  ]);

  /* ---------------- 7. Transaksi dibatalkan ---------------- */
  if (data.gagal.length) {
    const g = wb.addWorksheet('Dibatalkan', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });
    g.columns = [{ width: 20 }, { width: 22 }, { width: 22 }, { width: 16 }, { width: 44 }];
    kepalaLembar(
      g,
      'TRANSAKSI DIBATALKAN',
      `${rentang}  ·  uangnya tidak ikut dihitung, nomornya sengaja tidak dipakai ulang`,
      5
    );
    kepalaTabel(g, 4, ['Nomor transaksi', 'Waktu', 'Dibatalkan oleh', 'Nilai belanja', 'Alasan']);

    let n = 5;
    for (const t of data.gagal) {
      const row = g.getRow(n++);
      row.getCell(1).value = t.nomor;
      row.getCell(2).value = tanggalJam(t.dibuat_pada);
      row.getCell(3).value = t.nama_pembatal || t.nama_kasir;
      row.getCell(4).value = t.total;
      row.getCell(4).numFmt = UANG;
      row.getCell(5).value = t.alasan_batal || '-';
    }
  }

  return wb.xlsx.writeBuffer();
}

/** Nama berkasnya ikut tanggalnya, supaya tidak saling menimpa di folder unduhan. */
export function namaBerkas(data) {
  const { tanggal_dari: dari, tanggal_sampai: sampai } = data;
  if (!dari) return 'Laporan-Penjualan-Boomboo.xlsx';
  if (dari === sampai) return `Laporan-Penjualan-Boomboo-${dari}.xlsx`;
  return `Laporan-Penjualan-Boomboo-${dari}-sampai-${sampai}.xlsx`;
}

export { rupiah };
