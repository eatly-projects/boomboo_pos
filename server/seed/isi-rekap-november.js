/**
 * Mengisi penjualan event 4-7 November 2026 yang TIDAK SEMPAT masuk aplikasi
 * karena sinyal terganggu, dari rekap tulisan tangan "Hari rabu tanggal 04.docx".
 *
 * Perintah:
 *   npm run seed:rekap-nov -- "<berkas teks rekap>"            # hanya memeriksa
 *   npm run seed:rekap-nov -- "<berkas teks rekap>" --tulis    # benar-benar menulis
 *
 * Tiga hal yang membuat perintah ini aman dijalankan di basis data berisi data
 * sungguhan:
 *
 *   1. AMAN DIULANG. Baris rekap yang keranjang + tanggal + totalnya sudah sama
 *      dengan transaksi yang ada dianggap "sudah masuk" dan dilewati. Jadi
 *      menjalankan dua kali tidak menggandakan apa pun - pencegah dobelnya
 *      adalah isi basis data itu sendiri, bukan penanda terpisah yang bisa
 *      hilang.
 *   2. SATU TRANSAKSI BASIS DATA. Kalau ada satu baris saja yang gagal,
 *      semuanya dibatalkan. Tidak ada keadaan setengah terisi.
 *   3. CEK SILANG SEBELUM COMMIT. Jumlah buku besar stok harus tetap sama
 *      dengan angka stok tiap produk, dan jumlah uang yang masuk harus sama
 *      dengan jumlah di rekap. Kalau tidak, semuanya dibatalkan.
 *
 * Angka uangnya memakai TOTAL YANG TERTULIS DI REKAP, bukan hasil hitungan
 * ulang. Selisih terhadap harga normal dicatat sebagai diskon `nominal`, jadi
 * tidak ada satu rupiah pun yang dikarang: `uang_masuk` sama dengan uang yang
 * benar-benar diterima menurut catatan kasir.
 */
import 'dotenv/config';
import fs from 'node:fs';
import { SKEMA } from '../src/shared/db/pool.js';
import { dalamTransaksi } from '../src/shared/db/transaksi-db.js';
import { gerakkanStok } from '../src/shared/stok/pergerakan.js';
import { catatLog } from '../src/shared/utils/log.js';
import { kodeAcak } from '../src/shared/utils/bantu.js';

/* ------------------------------------------------------------------ */
/* Harga dan produk                                                    */
/* ------------------------------------------------------------------ */

/**
 * Harga satuan yang dipakai sebagai "harga normal" di baris transaksi.
 * Sumbernya daftar harga `Product List.pdf` (9 Nov 2026), KECUALI:
 *   - Sesame Garlic Chili Oil: daftar harga 59.000, tapi seluruh transaksi
 *     4-7 Nov yang sudah masuk memakai 60.000, jadi yang dipakai 60.000
 *     supaya harga di satu event tidak dua macam.
 *   - Boom Chips: daftar harga 44.000/48.000, tapi di event dijual 20.000
 *     (keputusan Lutfi 9 Nov 2026: katalog memakai harga event).
 */
const HARGA = {
  'Sambal Daun Jeruk Level 2': 38000,
  'Sambal Daun Jeruk Level 4': 43000,
  'Sambal Cumi Daun Jeruk Level 2': 48000,
  'Sambal Cumi Daun Jeruk Level 4': 48000,
  'Sambal Ikan Teri Daun Jeruk Level 2': 48000,
  'Sambal Ikan Teri Daun Jeruk Level 4': 48000,
  'Sambal Ikan Cakalang Daun Jeruk Level 2': 48000,
  'Sambal Daun Jeruk Sachet Level 2': 63000,
  'Sambal Daun Jeruk Sachet Level 4': 69000,
  'Sesame Garlic Chili Oil': 60000,
  'air Mineral': 10000,
  'Abon Ikan Tuna Manis Pedas': 60000,
  'Abon Ikan Tuna Original': 60000,
  'Crunchy Chili Onion Sprinkle Original': 44000,
  'Crunchy Chili Onion Sprinkle Hot': 44000,
  'Crunchy Abon Tuna Tabur Original': 44000,
  'Crunchy Abon Tuna Tabur Hot': 44000,
  'Boom Chips Sea Salt': 20000,
  'Boom Chips BBQ': 20000,
  'Boom Chips Jagung Bakar': 20000,
  'Boom Chips Salted Egg': 20000,
  'Boom Chips Signature Chili Oil': 20000,
};

/** Jam event dipakai untuk menyebar transaksi yang jamnya tidak tercatat. */
const JAM_MULAI = 11;
const JAM_SELESAI = 17;

const PENANDA_STOK =
  'Stok dibawa ke event 4-7 Nov 2026, tidak tercatat saat itu. Dicatat belakangan dari rekap tulisan tangan.';

/* ------------------------------------------------------------------ */
/* Membaca rekap                                                       */
/* ------------------------------------------------------------------ */

const HARI = [
  [/hari rabu tanggal 04/i, '2026-11-04'],
  [/hari kamis 05/i, '2026-11-05'],
  [/hari jumat tanggal 06/i, '2026-11-06'],
  [/sabtu tanggal 7/i, '2026-11-07'],
];

const bersih = (s) =>
  s.toLowerCase().replace(/[`'"]/g, ' ').replace(/\s+/g, ' ').trim();

const ambilLevel = (s) => {
  const m = s.match(/(?:lvl?|level|levl)\s*([24])\b/) || s.match(/lvl([24])\b/);
  return m ? Number(m[1]) : null;
};

/** Menerjemahkan nama tulisan tangan (banyak salah ketik) ke nama katalog. */
function petakan(namaMentah) {
  const t = bersih(namaMentah);
  const lv = ambilLevel(t);
  const ada = (...kk) => kk.some((k) => t.includes(k));

  // chips harus diperiksa lebih dulu: "boom chips signature chili oil"
  // mengandung kata "chili oil" yang juga nama produk lain
  if (ada('chips')) {
    if (ada('sea salt')) return ['Boom Chips Sea Salt', null];
    if (ada('bbq')) return ['Boom Chips BBQ', null];
    if (ada('jagung')) return ['Boom Chips Jagung Bakar', null];
    if (ada('salted egg')) return ['Boom Chips Salted Egg', null];
    if (ada('signature')) return ['Boom Chips Signature Chili Oil', null];
    return [null, 'rasa chips tidak dikenali'];
  }
  if (ada('springk', 'sprinkle', 'sprinkel')) {
    if (ada('hot')) return ['Crunchy Chili Onion Sprinkle Hot', null];
    if (ada('ori')) return ['Crunchy Chili Onion Sprinkle Original', null];
    return [null, 'sprinkle tanpa keterangan hot atau original'];
  }
  if (ada('abon')) {
    // "abon tabur" = botol tabur 45 g (44.000), "abon" saja = pouch 100 g (60.000).
    // Terbukti dari tiga baris rekap yang totalnya cocok persis dengan harga ini.
    const pedas = ada('pedas', 'manis');
    if (ada('tabur'))
      return [pedas ? 'Crunchy Abon Tuna Tabur Hot' : 'Crunchy Abon Tuna Tabur Original', null];
    return [pedas ? 'Abon Ikan Tuna Manis Pedas' : 'Abon Ikan Tuna Original', null];
  }
  if (ada('air mineral', 'mineral')) return ['air Mineral', null];
  if (ada('sesame', 'chili oil', 'chilie oil', 'cili oil') || /^(chili|chilie|cili|chilli)$/.test(t))
    return ['Sesame Garlic Chili Oil', null];
  if (ada('sachet', 'sachect', 'sachech', 'saschet')) {
    if (!lv) return [null, 'sachet tanpa level'];
    return [`Sambal Daun Jeruk Sachet Level ${lv}`, null];
  }
  if (ada('cakalang', 'caklaang', 'caklang', 'cakalng'))
    return [
      'Sambal Ikan Cakalang Daun Jeruk Level 2',
      lv && lv !== 2 ? `cakalang level ${lv} tidak ada di katalog` : null,
    ];
  if (ada('cumi', 'cui'))
    return [
      `Sambal Cumi Daun Jeruk Level ${lv || 2}`,
      lv ? null : 'cumi tanpa level, dianggap Level 2',
    ];
  if (ada('teri'))
    return [
      `Sambal Ikan Teri Daun Jeruk Level ${lv || 2}`,
      lv ? null : 'teri tanpa level, dianggap Level 2',
    ];
  if (ada('sdgj', 'daun jeruk'))
    return [
      `Sambal Daun Jeruk Level ${lv || 2}`,
      lv ? null : 'SDGJ tanpa level, dianggap Level 2',
    ];
  return [null, 'nama tidak dikenali'];
}

/** Aturan diskon event, diturunkan dari 40 transaksi yang sudah masuk. */
const persenDiskon = (unit) => (unit >= 4 ? 15 : unit >= 2 ? 10 : 0);

function uraikan(teks) {
  const baris = [];
  let tanggal = null;

  for (const mentah of teks.split(/\r?\n/)) {
    let t = mentah.trim();
    if (!t) continue;
    // Baris berawalan # adalah catatan manusia, bukan transaksi. Harus
    // dilewati SEBELUM judul hari dicari, karena catatannya sendiri bisa
    // menyebut nama berkas "Hari rabu tanggal 04.docx".
    if (t.startsWith('#')) continue;

    for (const [pola, tgl] of HARI) {
      if (pola.test(t)) {
        tanggal = tgl;
        t = t.replace(pola, '').trim();
      }
    }
    if (!t || !tanggal) continue;

    // Dua transaksi kadang menempel jadi satu baris:
    // "... cumi 1 harga 864002.  Teri lvl 4 1, ..."
    // Nomor urut tidak pernah mulai dengan 0, kalau tidak "86400" ikut terpecah.
    for (let p of t.split(/(?<=\d{4})(?=[1-9]\d?\.\s+[A-Za-z])/)) {
      p = p.replace(/^\s*\d+[.)]\s*/, '').trim();
      if (p) baris.push({ tanggal, mentah: p });
    }
  }

  return baris.map((b) => {
    const barang = [];
    const catatan = [];
    let total = null;

    /**
     * "(tanpa kembalian, dibayar 100000)" - pembeli membayar lebih besar dari
     * nilai keranjangnya dan tidak mengambil kembalian.
     *
     * Ini BUKAN diskon, jadi tidak boleh dicatat sebagai diskon negatif:
     * nilai keranjangnya tetap harga normal, yang berbeda hanya uang yang
     * benar-benar bergerak. Kolom `uang_masuk` memang dibuat untuk ini
     * (lihat migrasi 002), sama seperti pada transaksi hasil penukaran.
     */
    let uangDiterima = null;
    const mLebih = b.mentah.match(/\(\s*tanpa kembalian,\s*dibayar\s*(\d{4,})\s*\)/i);
    const mentahBersih = mLebih ? b.mentah.replace(mLebih[0], '').trim().replace(/,\s*$/, '') : b.mentah;
    if (mLebih) uangDiterima = Number(mLebih[1]);

    const potongan = mentahBersih.split(',').map((x) => x.trim()).filter(Boolean);

    const tambah = (namaMentah, jumlah) => {
      const [nama, galat] = petakan(namaMentah);
      if (galat) catatan.push(galat);
      if (nama) {
        const ada = barang.find((x) => x.nama === nama);
        if (ada) {
          ada.jumlah += jumlah;
          catatan.push('barang yang sama tertulis dua kali');
        } else barang.push({ nama, jumlah });
      } else catatan.push(`tidak dikenali: "${namaMentah}"`);
    };

    for (const [i, pot] of potongan.entries()) {
      const terakhir = i === potongan.length - 1;

      const mTotal = pot.match(/^(?:har[ag]+a?n?y?a?\s*)?(\d{4,})$/i);
      if (mTotal && terakhir) {
        total = Number(mTotal[1]);
        continue;
      }
      const mGabung = pot.match(/^(.*?)\s+har[ag]+a?n?y?a?\s*(\d{4,})$/i);
      if (mGabung) {
        tambah(mGabung[1], 1);
        total = Number(mGabung[2]);
        continue;
      }
      const mDuaAngka = pot.match(/^(.*?)\s+(\d{1,2})\s+(\d{4,})$/);
      if (mDuaAngka && terakhir) {
        tambah(mDuaAngka[1], Number(mDuaAngka[2]));
        total = Number(mDuaAngka[3]);
        continue;
      }
      const mNamaTotal = pot.match(/^(.*?[A-Za-z])\s+(\d{4,})$/);
      if (mNamaTotal && terakhir) {
        tambah(mNamaTotal[1], 1);
        total = Number(mNamaTotal[2]);
        continue;
      }
      const mJumlah = pot.match(/^(.*?)\s+(\d{1,2})$/);
      if (mJumlah) {
        tambah(mJumlah[1], Number(mJumlah[2]));
        continue;
      }
      tambah(pot, 1);
    }

    const unit = barang.reduce((j, x) => j + x.jumlah, 0);
    const subtotal = barang.reduce((j, x) => j + (HARGA[x.nama] ?? 0) * x.jumlah, 0);
    const persenWajar = persenDiskon(unit);
    const totalWajar = Math.round(subtotal * (1 - persenWajar / 100));
    const persenTersirat =
      subtotal > 0 && total !== null ? Math.round((1 - total / subtotal) * 1000) / 10 : null;

    return {
      ...b,
      barang,
      catatan,
      total,
      uangDiterima,
      unit,
      subtotal,
      totalWajar,
      persenTersirat,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Penyaring: mana yang boleh masuk                                    */
/* ------------------------------------------------------------------ */

/**
 * Sidik jari satu transaksi: tanggal, isi keranjang, nilai keranjang, dan uang
 * yang bergerak. Uang ikut dihitung supaya penjualan Rp 48.000 biasa tidak
 * tertukar dengan penjualan Rp 48.000 yang pembelinya membayar Rp 100.000 dan
 * tidak mengambil kembalian - keranjangnya sama, tapi itu dua transaksi
 * berbeda.
 */
const sidik = (tanggal, barang, total, uang) =>
  `${tanggal}|${barang.map((x) => `${x.nama}x${x.jumlah}`).sort().join('+')}|${total}|${uang ?? total}`;

/** Baris yang angkanya tidak mungkin benar, jadi tidak boleh ditebak. */
function alasanDitolak(b) {
  if (b.total === null) return 'total tidak terbaca';
  if (!b.barang.length) return 'tidak ada barang yang terbaca';
  if (b.catatan.some((c) => c.startsWith('tidak dikenali'))) return 'ada nama barang yang tidak dikenali';
  if (b.catatan.includes('barang yang sama tertulis dua kali'))
    return 'barang yang sama tertulis dua kali, kemungkinan salah ketik level';
  if (b.persenTersirat < -0.5) return `total ${b.total} lebih besar dari harga normal ${b.subtotal}`;
  if (b.persenTersirat > 55) return `potongannya ${b.persenTersirat}%, terlalu dalam untuk diterima tanpa penjelasan`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Jalan                                                               */
/* ------------------------------------------------------------------ */

const argumen = process.argv.slice(2);
const TULIS = argumen.includes('--tulis');
const BERKAS = argumen.find((a) => !a.startsWith('--'));

if (!BERKAS) {
  console.error('Sebutkan berkas teks rekapnya. Contoh:');
  console.error('  npm run seed:rekap-nov -- "rekap-november.txt"');
  process.exit(1);
}

const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

async function jalankan() {
  const semua = uraikan(fs.readFileSync(BERKAS, 'utf8'));
  console.log(`\nRekap terbaca: ${semua.length} baris dari ${BERKAS}\n`);

  await dalamTransaksi(async (klien) => {
    /* --- penjaga: pastikan berdiri di skema yang benar --- */
    const { rows: cekSkema } = await klien.query('select current_schema() as s');
    if (cekSkema[0].s !== SKEMA)
      throw new Error(`Jalur pencarian tabel bukan "${SKEMA}" melainkan "${cekSkema[0].s}". Dibatalkan.`);

    /* --- siapa yang mencatat --- */
    const { rows: cariUser } = await klien.query(
      `select id, nama from users where email = $1`,
      ['lutfi_new@boomboo.id'],
    );
    if (!cariUser[0]) throw new Error('Akun lutfi_new@boomboo.id tidak ditemukan.');
    const user = cariUser[0];

    /* --- transaksi yang sudah ada di tanggal event --- */
    const { rows: adaDb } = await klien.query(`
      select t.total, t.uang_masuk, to_char(t.dibuat_pada at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as tanggal,
             json_agg(json_build_object('nama', i.nama_barang, 'jumlah', i.jumlah)) as barang
        from transaksi t
        join transaksi_item i on i.transaksi_id = t.id
       where (t.dibuat_pada at time zone 'Asia/Jakarta')::date between '2026-11-04' and '2026-11-07'
       group by t.id, t.total, t.dibuat_pada
    `);
    const sudahAdaSet = new Set(
      adaDb.map((r) => sidik(r.tanggal, r.barang, Number(r.total), Number(r.uang_masuk))),
    );

    /* --- bagi tiga --- */
    const sudahAda = [];
    const ditolak = [];
    const masuk = [];
    for (const b of semua) {
      if (sudahAdaSet.has(sidik(b.tanggal, b.barang, b.total, b.uangDiterima ?? b.total)))
        sudahAda.push(b);
      else {
        const alasan = alasanDitolak(b);
        if (alasan) ditolak.push({ ...b, alasan });
        else masuk.push(b);
      }
    }

    console.log('='.repeat(96));
    console.log(`Sudah ada di aplikasi, dilewati : ${sudahAda.length}`);
    console.log(`Perlu dibetulkan dulu, dilewati : ${ditolak.length}`);
    console.log(
      `Akan dimasukkan                 : ${masuk.length}  (${rupiah(masuk.reduce((j, b) => j + (b.uangDiterima ?? b.total), 0))})`,
    );
    console.log('='.repeat(96));

    if (ditolak.length) {
      console.log('\nBARIS YANG DILEWATI KARENA ANGKANYA PERLU DIBETULKAN:\n');
      for (const b of ditolak) {
        console.log(`  [${b.tanggal.slice(8)} Nov] "${b.mentah}"`);
        console.log(`      ${b.alasan}`);
        console.log(
          `      terbaca: ${b.barang.map((x) => `${x.nama} x${x.jumlah}`).join(' | ') || '(tidak ada)'} | harga normal ${b.subtotal}`,
        );
      }
    }

    /* --- produk yang belum ada di katalog --- */
    const butuhUnit = {};
    for (const b of masuk) for (const x of b.barang) butuhUnit[x.nama] = (butuhUnit[x.nama] || 0) + x.jumlah;

    const { rows: produkDb } = await klien.query('select id, nama, stok from produk');
    const peta = new Map(produkDb.map((p) => [p.nama.toLowerCase(), p]));

    const produkBaru = Object.keys(butuhUnit).filter((n) => !peta.has(n.toLowerCase()));
    console.log(`\nPRODUK BARU YANG AKAN DITAMBAHKAN: ${produkBaru.length}`);
    for (const n of produkBaru.sort()) console.log(`   ${n.padEnd(42)} ${rupiah(HARGA[n])}  stok 0`);

    /* --- stok masuk yang perlu dicatat --- */
    const stokMasuk = [];
    for (const [nama, perlu] of Object.entries(butuhUnit)) {
      const p = peta.get(nama.toLowerCase());
      const stokSekarang = p ? p.stok : 0;
      const kurang = Math.max(0, perlu - stokSekarang);
      if (kurang > 0) stokMasuk.push({ nama, perlu, stokSekarang, kurang });
    }
    console.log(`\nSTOK MASUK YANG AKAN DICATAT (4 Nov 08.00, sebelum transaksi pertama): ${stokMasuk.length}`);
    for (const s of stokMasuk.sort((a, b) => b.kurang - a.kurang))
      console.log(
        `   ${s.nama.padEnd(42)} butuh ${String(s.perlu).padStart(3)}, stok ${String(s.stokSekarang).padStart(3)} -> tambah ${s.kurang}`,
      );

    const perHari = {};
    for (const b of masuk) {
      perHari[b.tanggal] ??= { transaksi: 0, uang: 0 };
      perHari[b.tanggal].transaksi++;
      perHari[b.tanggal].uang += b.total;
    }
    console.log('\nYANG AKAN MASUK PER TANGGAL:');
    for (const [t, v] of Object.entries(perHari).sort())
      console.log(`   ${t}  ${String(v.transaksi).padStart(3)} transaksi  ${rupiah(v.uang)}`);

    if (!TULIS) {
      console.log('\n>>> HANYA PEMERIKSAAN. Tidak ada yang ditulis.');
      console.log('>>> Tambahkan --tulis kalau rencana di atas sudah benar.\n');
      throw new BatalkanSaja();
    }

    /* ================= mulai menulis ================= */
    console.log('\nMenulis...');

    for (const nama of produkBaru) {
      const { rows } = await klien.query(
        `insert into produk (nama, harga, stok, dijual_satuan) values ($1, $2, 0, true) returning id, nama, stok`,
        [nama, HARGA[nama]],
      );
      peta.set(nama.toLowerCase(), rows[0]);
      await catatLog(
        {
          user,
          aksi: 'tambah_produk',
          entitas: 'produk',
          entitasId: rows[0].id,
          namaEntitas: nama,
          detail: { harga: HARGA[nama], stok: 0, sumber: 'Product List 9 Nov 2026, menyusul rekap event' },
        },
        klien,
      );
    }

    for (const s of stokMasuk) {
      const p = peta.get(s.nama.toLowerCase());
      await gerakkanStok(klien, {
        produkId: p.id,
        jenis: 'penambahan',
        jumlah: s.kurang,
        catatan: PENANDA_STOK,
        user,
      });
      await catatLog(
        {
          user,
          aksi: 'tambah_stok',
          entitas: 'produk',
          entitasId: p.id,
          namaEntitas: s.nama,
          detail: { jumlah: s.kurang, catatan: PENANDA_STOK },
        },
        klien,
      );
    }
    // Stok masuk itu terjadi sebelum transaksi pertama, bukan hari ini.
    await klien.query(
      `update pergerakan_stok set dibuat_pada = $1
        where jenis = 'penambahan' and catatan = $2 and dibuat_pada::date = current_date`,
      ['2026-11-04T08:00:00+07:00', PENANDA_STOK],
    );

    /* --- nomor transaksi terakhir per tanggal --- */
    const nomorTerakhir = {};
    for (const tgl of Object.keys(perHari)) {
      const { rows } = await klien.query(
        `select coalesce(max(right(nomor, 4)::int), 0) as n from transaksi where nomor like $1`,
        [`BB-${tgl.replace(/-/g, '')}-%`],
      );
      nomorTerakhir[tgl] = rows[0].n;
    }

    let jumlahMasuk = 0;
    let uangMasuk = 0;

    for (const tgl of Object.keys(perHari).sort()) {
      const barisHari = masuk.filter((b) => b.tanggal === tgl);
      const langkah =
        barisHari.length > 1 ? ((JAM_SELESAI - JAM_MULAI) * 60) / (barisHari.length - 1) : 0;

      for (const [i, b] of barisHari.entries()) {
        const menit = Math.round(JAM_MULAI * 60 + langkah * i);
        const jam = String(Math.floor(menit / 60)).padStart(2, '0');
        const mnt = String(menit % 60).padStart(2, '0');
        const waktu = `${tgl}T${jam}:${mnt}:00+07:00`;

        const nomor = `BB-${tgl.replace(/-/g, '')}-${String(++nomorTerakhir[tgl]).padStart(4, '0')}`;

        const item = b.barang.map((x, urutan) => ({
          ...x,
          harga: HARGA[x.nama],
          subtotal: HARGA[x.nama] * x.jumlah,
          urutan,
        }));
        const subtotal = item.reduce((j, x) => j + x.subtotal, 0);
        const potongan = subtotal - b.total;
        // Nilai keranjang tetap `b.total`; yang bisa lebih besar hanya uang
        // yang bergerak, saat pembeli tidak mengambil kembaliannya.
        const uangTransaksi = b.uangDiterima ?? b.total;

        const { rows: trx } = await klien.query(
          `insert into transaksi
             (nomor, kode_struk, status, metode_bayar, subtotal, diskon_jenis, diskon_nilai,
              diskon_rupiah, total, uang_masuk, kasir_id, nama_kasir,
              dikonfirmasi_oleh_id, nama_pengonfirmasi, dibuat_pada, dikonfirmasi_pada)
           values ($1,$2,'selesai','qris',$3,$4,$5,$6,$7,$11,$8,$9,$8,$9,$10,$10)
           returning id, nomor`,
          [
            nomor,
            kodeAcak(24),
            subtotal,
            potongan > 0 ? 'nominal' : null,
            potongan > 0 ? potongan : null,
            potongan > 0 ? potongan : 0,
            b.total,
            user.id,
            user.nama,
            waktu,
            uangTransaksi,
          ],
        );
        const transaksiId = trx[0].id;

        for (const x of item) {
          await klien.query(
            `insert into transaksi_item
               (transaksi_id, jenis_barang, barang_id, nama_barang, harga_normal,
                harga_dipakai, jumlah, subtotal, urutan)
             values ($1,'produk',$2,$3,$4,$4,$5,$6,$7)`,
            [
              transaksiId,
              peta.get(x.nama.toLowerCase()).id,
              x.nama,
              x.harga,
              x.jumlah,
              x.subtotal,
              x.urutan,
            ],
          );

          await gerakkanStok(klien, {
            produkId: peta.get(x.nama.toLowerCase()).id,
            jenis: 'penjualan',
            jumlah: -x.jumlah,
            transaksiId,
            catatan: `Terjual lewat transaksi ${nomor}`,
            user,
          });
        }

        // Buku besar stoknya harus bertanggal sama dengan transaksinya,
        // kalau tidak laporan harian stok dan penjualan jadi tidak sejalan.
        await klien.query('update pergerakan_stok set dibuat_pada = $1 where transaksi_id = $2', [
          waktu,
          transaksiId,
        ]);

        await catatLog(
          {
            user,
            aksi: 'konfirmasi_pembayaran',
            entitas: 'transaksi',
            entitasId: transaksiId,
            namaEntitas: nomor,
            detail: {
              metode_bayar: 'qris',
              total: b.total,
              susulan_dari_rekap: true,
              baris_rekap: b.mentah,
              harga_normal: subtotal,
              potongan_rupiah: potongan > 0 ? potongan : 0,
              ...(b.uangDiterima
                ? {
                    uang_masuk: b.uangDiterima,
                    catatan_uang: `Pembeli membayar Rp ${b.uangDiterima.toLocaleString('id-ID')} dan tidak mengambil kembalian. Nilai keranjangnya Rp ${b.total.toLocaleString('id-ID')}.`,
                  }
                : {}),
            },
          },
          klien,
        );

        jumlahMasuk++;
        uangMasuk += uangTransaksi;
      }

      await klien.query(
        `insert into urutan_nomor (tanggal, terakhir) values ($1, $2)
         on conflict (tanggal) do update set terakhir = greatest(urutan_nomor.terakhir, $2)`,
        [tgl, nomorTerakhir[tgl]],
      );
    }

    await catatLog(
      {
        user,
        aksi: 'isi_rekap_susulan',
        entitas: 'transaksi',
        entitasId: null,
        namaEntitas: 'Rekap event 4-7 November 2026',
        detail: {
          dimasukkan: jumlahMasuk,
          uang: uangMasuk,
          dilewati_sudah_ada: sudahAda.length,
          dilewati_perlu_dibetulkan: ditolak.length,
          produk_baru: produkBaru,
          stok_masuk: stokMasuk.map((s) => `${s.nama} +${s.kurang}`),
          catatan:
            'Diisi dari rekap tulisan tangan karena sinyal terganggu saat event. Jam transaksi disebar merata 11.00-17.00 karena rekapnya tidak mencatat jam.',
        },
      },
      klien,
    );

    /* ================= cek silang sebelum commit ================= */
    const { rows: silang } = await klien.query(`
      select p.nama, p.stok, coalesce(sum(g.jumlah), 0)::int as buku
        from produk p left join pergerakan_stok g on g.produk_id = p.id
       group by p.id, p.nama, p.stok
      having p.stok <> coalesce(sum(g.jumlah), 0)
    `);
    if (silang.length) {
      console.error(silang);
      throw new Error('Angka stok tidak cocok dengan buku besar. Semuanya dibatalkan.');
    }

    const { rows: minus } = await klien.query('select nama, stok from produk where stok < 0');
    if (minus.length) {
      console.error(minus);
      throw new Error('Ada stok yang jadi minus. Semuanya dibatalkan.');
    }

    if (jumlahMasuk !== masuk.length)
      throw new Error(`Yang masuk ${jumlahMasuk}, seharusnya ${masuk.length}. Dibatalkan.`);

    const uangSeharusnya = masuk.reduce((j, b) => j + (b.uangDiterima ?? b.total), 0);
    if (uangMasuk !== uangSeharusnya)
      throw new Error(`Uang masuk ${uangMasuk}, seharusnya ${uangSeharusnya}. Dibatalkan.`);

    const { rows: cekUang } = await klien.query(`
      select count(*)::int as jml, coalesce(sum(uang_masuk), 0)::bigint as uang
        from transaksi
       where status = 'selesai'
         and (dibuat_pada at time zone 'Asia/Jakarta')::date between '2026-11-04' and '2026-11-07'
    `);

    console.log(`\nSelesai. ${jumlahMasuk} transaksi masuk, ${rupiah(uangMasuk)}.`);
    console.log(
      `Event 4-7 Nov sekarang: ${cekUang[0].jml} transaksi berhasil, ${rupiah(cekUang[0].uang)}.`,
    );
    console.log('Cek silang stok lolos, tidak ada stok minus.');
  });
}

/** Dipakai untuk membatalkan transaksi basis data saat mode periksa saja. */
class BatalkanSaja extends Error {}

jalankan()
  .then(() => process.exit(0))
  .catch((e) => {
    if (e instanceof BatalkanSaja) process.exit(0);
    console.error('\nGAGAL:', e.message);
    process.exit(1);
  });
