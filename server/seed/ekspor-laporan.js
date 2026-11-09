/**
 * Mengekspor Laporan Penjualan ke PDF dan Excel, langsung jadi berkas.
 *
 *   npm run laporan:ekspor -- 2026-11-04 2026-11-07 ["folder tujuan"]
 *
 * Yang Excel memakai pembuat berkas yang SAMA dengan tombol "Unduh Excel" di
 * aplikasi (`laporan.excel.js`), jadi isinya tidak mungkin berbeda.
 *
 * Yang PDF dibuat dengan menyusun ulang tampilan halaman Laporan Penjualan
 * sebagai satu berkas HTML, lalu dicetak memakai Microsoft Edge dalam mode
 * tanpa jendela. Angkanya diambil dari `laporan.service.js` yang sama dengan
 * yang dipakai halamannya, jadi angka di PDF, Excel, dan layar pasti sama.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { harian } from '../src/features/laporan/laporan.service.js';
import { buatExcel } from '../src/features/laporan/laporan.excel.js';

/* ---------------- pembentuk tampilan angka dan tanggal ---------------- */
/* Disamakan dengan web/src/shared/lib/format.js supaya PDF-nya sama       */

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
const angka = (n) => Number(n || 0).toLocaleString('id-ID');

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const keTanggal = (v) => (v instanceof Date ? v : new Date(v));
const tanggalPanjang = (v) => {
  if (!v) return '-';
  const d = keTanggal(v);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
const tanggalLengkap = (v) => (v ? `${HARI[keTanggal(v).getDay()]}, ${tanggalPanjang(v)}` : '-');
const jam = (v) => {
  if (!v) return '-';
  const d = keTanggal(v);
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
};
const aman = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------------------------- tampilan ---------------------------- */

const WARNA = {
  boom500: '#e43222',
  boom600: '#c83c32',
  boom50: '#fef2f1',
  daun700: '#3d5527',
  biji100: '#fbf3dd',
  coklat900: '#3d1f12',
  coklat600: '#5c3a28',
  coklat400: '#8a6d5d',
  netral100: '#f5f5f4',
  netral200: '#e8e8e7',
  netral300: '#d1d1d0',
};

const GAYA = `
  @page { size: A4 portrait; margin: 12mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    color: ${WARNA.coklat900};
    font-size: 11px;
    background: #fff;
  }
  .tumpuk { display: flex; flex-direction: column; gap: 10px; }
  .kepala { border: 2px solid ${WARNA.boom500}; border-radius: 14px; overflow: hidden; break-inside: avoid; }
  .kepala-atas {
    background: ${WARNA.boom500}; color: #fff; padding: 14px 18px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .kepala-atas .label { font-size: 9px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.72); }
  .kepala-atas .judul { font-size: 17px; font-weight: 800; margin-top: 2px; }
  .kepala-atas img { height: 34px; }
  .kepala-bawah { background: ${WARNA.biji100}; color: ${WARNA.coklat600}; padding: 6px 18px; font-size: 9px; }

  .angka-besar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; break-inside: avoid; }
  .kotak { border: 2px solid ${WARNA.netral200}; border-radius: 14px; padding: 10px 12px; background: #fff; }
  .kotak.utama { border-color: ${WARNA.boom500}; background: ${WARNA.boom50}; }
  .kotak .judul { font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${WARNA.coklat400}; }
  .kotak .nilai { font-size: 15px; font-weight: 800; margin-top: 3px; letter-spacing: -.01em; }
  .kotak.utama .nilai { color: ${WARNA.boom600}; font-size: 17px; }
  .kotak .ket { font-size: 8px; color: ${WARNA.coklat400}; margin-top: 2px; }

  section { border: 2px solid ${WARNA.netral200}; border-radius: 14px; background: #fff; break-inside: avoid; }
  section > .tajuk { border-bottom: 2px solid ${WARNA.netral200}; padding: 8px 14px; }
  section > .tajuk h2 { font-size: 12px; font-weight: 700; }
  section > .tajuk p { font-size: 9px; color: ${WARNA.coklat400}; margin-top: 1px; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th {
    font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: ${WARNA.coklat400}; text-align: left; padding: 7px 14px;
    border-bottom: 2px solid ${WARNA.netral100};
  }
  td { padding: 6px 14px; border-top: 1px solid ${WARNA.netral100}; vertical-align: top; }
  tbody tr:first-child td { border-top: none; }
  .kanan { text-align: right; }
  .tebal { font-weight: 700; }
  .redup { color: ${WARNA.coklat400}; }
  .hijau { color: ${WARNA.daun700}; }
  .merah { color: ${WARNA.boom600}; }
  .kuning { color: #8a6d2f; font-weight: 600; }
  .nowrap { white-space: nowrap; }
  tr.total td { border-top: 2px solid ${WARNA.boom500}; background: ${WARNA.biji100}; font-weight: 700; }

  .bilah { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; }
  .bilah-baris { display: flex; align-items: center; gap: 10px; font-size: 9px; }
  .bilah-jam { width: 38px; color: ${WARNA.coklat400}; flex: none; }
  .bilah-lajur { height: 13px; flex: 1; background: ${WARNA.netral100}; border-radius: 5px; overflow: hidden; }
  .bilah-isi { height: 100%; background: ${WARNA.boom500}; border-radius: 5px; }
  .bilah-uang { width: 82px; flex: none; text-align: right; font-weight: 600; }
  .bilah-trx { width: 42px; flex: none; text-align: right; color: ${WARNA.coklat400}; }

  .peringatan { border: 2px solid ${WARNA.boom500}; background: ${WARNA.boom50}; border-radius: 14px; padding: 10px 14px; break-inside: avoid; }
  .peringatan b { color: ${WARNA.boom600}; }
  .kaki { text-align: center; font-size: 8px; color: ${WARNA.coklat400}; padding-top: 4px; }
  .pisah { break-before: page; }
`;

function susunHtml(d, dari, sampai, logoDataUri) {
  const r = d.ringkasan;
  const bagian = [];

  const tabel = (judul, keterangan, kepala, rata, baris, extra = '') => {
    if (!baris.length) return '';
    const th = kepala
      .map((k, i) => `<th class="${rata[i] === 'kanan' ? 'kanan' : ''}">${aman(k)}</th>`)
      .join('');
    return `<section>
      <div class="tajuk"><h2>${aman(judul)}</h2>${keterangan ? `<p>${aman(keterangan)}</p>` : ''}</div>
      <table><thead><tr>${th}</tr></thead><tbody>${baris.join('')}${extra}</tbody></table>
    </section>`;
  };

  /* kepala bermerek */
  bagian.push(`<div class="kepala">
    <div class="kepala-atas">
      <div>
        <div class="label">Laporan Penjualan</div>
        <div class="judul">${
          d.satu_hari
            ? aman(tanggalLengkap(dari + 'T00:00:00'))
            : `${aman(tanggalPanjang(dari + 'T00:00:00'))} sampai ${aman(tanggalPanjang(sampai + 'T00:00:00'))}`
        }</div>
      </div>
      ${logoDataUri ? `<img src="${logoDataUri}" alt="Boomboo">` : ''}
    </div>
    <div class="kepala-bawah">Dicetak ${aman(tanggalPanjang(d.dibuat_pada))}, ${aman(jam(d.dibuat_pada))} &middot; Aplikasi Kasir Boomboo</div>
  </div>`);

  /* empat angka utama */
  bagian.push(`<div class="angka-besar">
    <div class="kotak utama">
      <div class="judul">Uang masuk</div><div class="nilai">${rupiah(r.total_uang_masuk)}</div>
      <div class="ket">Uang yang benar-benar diterima</div>
    </div>
    <div class="kotak">
      <div class="judul">Transaksi berhasil</div><div class="nilai">${angka(r.jumlah_transaksi)}</div>
      <div class="ket">${r.jumlah_batal > 0 ? `${angka(r.jumlah_batal)} dibatalkan` : 'Tidak ada yang dibatalkan'}</div>
    </div>
    <div class="kotak">
      <div class="judul">Rata-rata per transaksi</div><div class="nilai">${rupiah(r.rata_rata_per_transaksi)}</div>
    </div>
    <div class="kotak">
      <div class="judul">Diskon diberikan</div><div class="nilai">${rupiah(r.total_diskon)}</div>
      <div class="ket">Dari ${rupiah(r.total_sebelum_diskon)} sebelum diskon</div>
    </div>
  </div>`);

  if (r.transaksi_stok_kurang > 0)
    bagian.push(`<div class="peringatan"><b>Ada transaksi dengan stok kurang.</b>
      ${angka(r.transaksi_stok_kurang)} transaksi diloloskan walaupun stoknya keburu habis diambil
      kasir lain. Stok fisiknya perlu diperiksa.</div>`);

  if (!d.satu_hari && d.per_hari.length > 1)
    bagian.push(
      tabel(
        'Uang masuk per hari',
        null,
        ['Tanggal', 'Transaksi', 'Uang masuk'],
        [null, 'kanan', 'kanan'],
        d.per_hari.map(
          (h) =>
            `<tr><td>${aman(tanggalLengkap(h.tanggal))}</td><td class="kanan">${angka(h.jumlah_transaksi)}</td><td class="kanan tebal">${rupiah(h.total)}</td></tr>`,
        ),
      ),
    );

  bagian.push(
    tabel(
      'Barang terjual',
      'Urut dari yang paling laku',
      ['Nama barang', 'Jenis', 'Terjual', 'Nilai penjualan'],
      [null, null, 'kanan', 'kanan'],
      d.terlaris.map(
        (t) =>
          `<tr><td class="tebal">${aman(t.nama_barang)}</td><td class="redup">${t.jenis_barang === 'menu' ? 'Menu makan' : 'Produk'}</td><td class="kanan">${angka(t.jumlah_terjual)}</td><td class="kanan tebal">${rupiah(t.total_penjualan)}</td></tr>`,
      ),
    ),
  );

  bagian.push(
    tabel(
      'Penjualan per kasir',
      null,
      ['Nama kasir', 'Transaksi', 'Uang masuk', 'Diskon diberikan'],
      [null, 'kanan', 'kanan', 'kanan'],
      d.per_kasir.map(
        (k) =>
          `<tr><td class="tebal">${aman(k.nama_kasir)}</td><td class="kanan">${angka(k.jumlah_transaksi)}</td><td class="kanan tebal">${rupiah(k.total)}</td><td class="kanan hijau">${rupiah(k.total_diskon)}</td></tr>`,
      ),
    ),
  );

  if (d.per_jam.length) {
    const puncak = Math.max(...d.per_jam.map((j) => Number(j.total)), 1);
    bagian.push(`<section>
      <div class="tajuk"><h2>Jam ramai</h2><p>Waktu Jakarta</p></div>
      <div class="bilah">${d.per_jam
        .map(
          (j) => `<div class="bilah-baris">
            <span class="bilah-jam">${String(j.jam).padStart(2, '0')}.00</span>
            <span class="bilah-lajur"><span class="bilah-isi" style="width:${Math.max((Number(j.total) / puncak) * 100, 2)}%"></span></span>
            <span class="bilah-uang">${rupiah(j.total)}</span>
            <span class="bilah-trx">${angka(j.jumlah_transaksi)} trx</span>
          </div>`,
        )
        .join('')}</div>
    </section>`);
  }

  if (d.stok_keluar.rincian.length)
    bagian.push(
      tabel(
        'Barang keluar bukan karena dijual',
        'Nilainya memakai harga jual, bukan harga modal. Baca catatannya sebelum menyimpulkan ini kerugian.',
        ['Waktu', 'Barang', 'Jumlah', 'Alasan', 'Catatan', 'Nilai'],
        [null, null, 'kanan', null, null, 'kanan'],
        d.stok_keluar.rincian.map(
          (s) =>
            `<tr><td class="redup nowrap">${aman(tanggalPanjang(s.dibuat_pada))}, ${aman(jam(s.dibuat_pada))}</td><td class="tebal">${aman(s.nama_produk)}</td><td class="kanan">${angka(s.jumlah)}</td><td>${aman(s.alasan)}</td><td class="${s.catatan ? 'kuning' : 'redup'}">${aman(s.catatan || '-')}</td><td class="kanan tebal">${rupiah(s.nilai)}</td></tr>`,
        ),
      ),
    );

  if (d.pengembalian.jumlah_kejadian > 0)
    bagian.push(
      tabel(
        'Pengembalian uang ke pembeli',
        null,
        ['Sumber dana', 'Jumlah'],
        [null, 'kanan'],
        [
          `<tr><td>Uang kantor</td><td class="kanan tebal">${rupiah(d.pengembalian.dari_kantor)}</td></tr>`,
          `<tr><td>Ditalangi kasir</td><td class="kanan tebal">${rupiah(d.pengembalian.ditalangi_kasir)}</td></tr>`,
          `<tr><td class="merah">Talangan kasir yang belum diganti</td><td class="kanan tebal merah">${rupiah(d.pengembalian.belum_diganti)}</td></tr>`,
        ],
      ),
    );

  if (d.gagal.length)
    bagian.push(
      tabel(
        'Transaksi dibatalkan',
        'Uangnya tidak ikut dihitung. Nomornya sengaja tidak dipakai ulang.',
        ['Nomor', 'Waktu', 'Dibatalkan oleh', 'Nilai belanja', 'Alasan'],
        [null, null, null, 'kanan', null],
        d.gagal.map(
          (t) =>
            `<tr><td class="tebal nowrap">${aman(t.nomor)}</td><td class="redup nowrap">${aman(tanggalPanjang(t.dibuat_pada))}, ${aman(jam(t.dibuat_pada))}</td><td>${aman(t.nama_pembatal || t.nama_kasir)}</td><td class="kanan">${rupiah(t.total)}</td><td class="redup">${aman(t.alasan_batal || '-')}</td></tr>`,
        ),
      ),
    );

  const totalBarang = d.transaksi.reduce((a, t) => a + Number(t.jumlah_barang), 0);
  const totalDiskon = d.transaksi.reduce((a, t) => a + Number(t.diskon_rupiah), 0);
  bagian.push(
    `<div class="pisah"></div>` +
      tabel(
        'Daftar seluruh transaksi',
        `${angka(d.transaksi.length)} transaksi berhasil`,
        ['Nomor', 'Jam', 'Kasir', 'Pembeli', 'Barang', 'Diskon', 'Uang masuk'],
        [null, null, null, null, 'kanan', 'kanan', 'kanan'],
        d.transaksi.map(
          (t) =>
            `<tr><td class="tebal nowrap">${aman(t.nomor)}</td><td class="redup nowrap">${aman(jam(t.dikonfirmasi_pada))}</td><td>${aman(t.nama_kasir)}</td><td class="redup">${aman(t.nama_pembeli || '-')}</td><td class="kanan">${angka(t.jumlah_barang)}</td><td class="kanan ${Number(t.diskon_rupiah) > 0 ? 'hijau' : 'redup'}">${Number(t.diskon_rupiah) > 0 ? rupiah(t.diskon_rupiah) : '-'}</td><td class="kanan tebal">${rupiah(t.uang_masuk)}</td></tr>`,
        ),
        `<tr class="total"><td>TOTAL</td><td></td><td></td><td></td><td class="kanan">${angka(totalBarang)}</td><td class="kanan hijau">${rupiah(totalDiskon)}</td><td class="kanan merah">${rupiah(r.total_uang_masuk)}</td></tr>`,
      ),
  );

  bagian.push(
    `<div class="kaki">Aplikasi Kasir Boomboo &middot; dicetak ${aman(tanggalPanjang(d.dibuat_pada))}, ${aman(jam(d.dibuat_pada))}</div>`,
  );

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<title>Laporan Penjualan Boomboo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${GAYA}</style>
</head><body><div class="tumpuk">${bagian.filter(Boolean).join('')}</div></body></html>`;
}

/* ------------------------------ jalan ------------------------------ */

const [dari, sampai, folderPilihan] = process.argv.slice(2);
if (!dari || !/^\d{4}-\d{2}-\d{2}$/.test(dari)) {
  console.error('Pakai: npm run laporan:ekspor -- 2026-11-04 2026-11-07 ["folder tujuan"]');
  process.exit(1);
}
const tglSampai = sampai && /^\d{4}-\d{2}-\d{2}$/.test(sampai) ? sampai : dari;
const tujuan = folderPilihan || path.join(os.homedir(), 'Downloads');

const PERAMBAN = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));

const d = await harian({ tanggal_dari: dari, tanggal_sampai: tglSampai });

if (d.ringkasan.jumlah_transaksi === 0) {
  console.error(`Tidak ada transaksi berhasil pada ${dari} sampai ${tglSampai}. Tidak ada yang diekspor.`);
  process.exit(1);
}

fs.mkdirSync(tujuan, { recursive: true });
const dasar =
  dari === tglSampai
    ? `Laporan-Penjualan-Boomboo-${dari}`
    : `Laporan-Penjualan-Boomboo-${dari}-sampai-${tglSampai}`;

/* --- Excel: pembuat yang sama dengan tombol di aplikasi --- */
const berkasExcel = path.join(tujuan, `${dasar}.xlsx`);
fs.writeFileSync(berkasExcel, await buatExcel(d));
console.log(`Excel : ${berkasExcel}  (${(fs.statSync(berkasExcel).size / 1024).toFixed(0)} KB)`);

/* --- PDF --- */
let logoDataUri = null;
const logo = path.resolve('../web/public/merek/logo-utama-putih.svg');
if (fs.existsSync(logo))
  logoDataUri = 'data:image/svg+xml;base64,' + fs.readFileSync(logo).toString('base64');

const html = susunHtml(d, dari, tglSampai, logoDataUri);
const berkasHtml = path.join(tujuan, `${dasar}.html`);
fs.writeFileSync(berkasHtml, html, 'utf8');

if (!PERAMBAN) {
  console.log(`HTML  : ${berkasHtml}`);
  console.log('PDF   : GAGAL - Edge maupun Chrome tidak ditemukan. Buka berkas HTML di atas lalu cetak jadi PDF.');
} else {
  const berkasPdf = path.join(tujuan, `${dasar}.pdf`);
  execFileSync(
    PERAMBAN,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${berkasPdf}`,
      `file:///${berkasHtml.replace(/\\/g, '/')}`,
    ],
    { stdio: 'pipe', timeout: 120000 },
  );
  if (!fs.existsSync(berkasPdf)) throw new Error('Peramban tidak menghasilkan berkas PDF.');
  console.log(`PDF   : ${berkasPdf}  (${(fs.statSync(berkasPdf).size / 1024).toFixed(0)} KB)`);
  fs.unlinkSync(berkasHtml);
}

console.log(
  `\nIsinya: ${angka(d.ringkasan.jumlah_transaksi)} transaksi berhasil, ${rupiah(d.ringkasan.total_uang_masuk)}.`,
);
process.exit(0);
