/**
 * Merapikan jam DAN nomor urut transaksi contoh.
 *
 * Ada dua hal yang dirapikan di sini.
 *
 * 1. Jam untuk HARI INI.
 *    Saat data contoh dibuat, tiap transaksi diberi jam acak antara pukul 10
 *    sampai 20. Untuk hari yang sudah lewat itu tidak masalah, tapi untuk
 *    hari ini sebagian jamnya jadi berada di masa depan, sehingga transaksi
 *    sungguhan yang baru dibuat justru tenggelam di bawahnya.
 *
 * 2. Nomor urut untuk SEMUA hari.
 *    Nomor dibagikan berurutan saat transaksi dibuat, sementara jamnya
 *    diacak belakangan. Akibatnya nomor dan jam tidak nyambung: bisa muncul
 *    BB-...-0019 pada pukul 13.05 padahal BB-...-0013 pada pukul 13.29.
 *    Daftar yang sebenarnya sudah urut jadi terlihat seperti berantakan.
 *    Di sini nomor dibagikan ulang mengikuti urutan jam.
 *
 * Pemakaian sungguhan tidak pernah bermasalah begini, karena nomor diambil
 * pada detik yang sama dengan waktu pembuatannya.
 *
 * Pakai:  npm run rapikan:jam
 */
import 'dotenv/config';
import pool, { kueri } from '../src/shared/db/pool.js';

const WIB = 7 * 60 * 60 * 1000;

try {
  /* ---------------------------------------------------------------- */
  /* 1. Sebar ulang jam transaksi hari ini                             */
  /* ---------------------------------------------------------------- */
  const sekarang = new Date();
  const batasAkhir = new Date(sekarang.getTime() - 5 * 60 * 1000);
  const hariIniWib = new Date(sekarang.getTime() + WIB);
  const mulai = new Date(
    Date.UTC(
      hariIniWib.getUTCFullYear(),
      hariIniWib.getUTCMonth(),
      hariIniWib.getUTCDate(),
      10 - 7 // pukul 10.00 WIB
    )
  );

  const { rows: hariIni } = await kueri(
    `select id from transaksi
      where (dibuat_pada at time zone 'Asia/Jakarta')::date
            = (now() at time zone 'Asia/Jakarta')::date
      order by dibuat_pada asc`
  );

  if (hariIni.length > 0) {
    const jarak = (batasAkhir.getTime() - mulai.getTime()) / (hariIni.length + 1);
    for (let i = 0; i < hariIni.length; i++) {
      const baru = new Date(mulai.getTime() + jarak * (i + 1));
      const selesai = new Date(baru.getTime() + 60 * 1000);
      await kueri(
        `update transaksi
            set dibuat_pada = $1::timestamptz,
                dikonfirmasi_pada = case when dikonfirmasi_pada is null then null else $2::timestamptz end,
                dibatalkan_pada   = case when dibatalkan_pada   is null then null else $2::timestamptz end
          where id = $3`,
        [baru, selesai, hariIni[i].id]
      );
      await kueri('update pergerakan_stok set dibuat_pada = $1 where transaksi_id = $2', [
        selesai,
        hariIni[i].id,
      ]);
      await kueri(
        `update log_aktivitas set dibuat_pada = $1 where entitas = 'transaksi' and entitas_id = $2`,
        [selesai, hariIni[i].id]
      );
    }
  }
  console.log(`\n1. Jam ${hariIni.length} transaksi hari ini disebar ulang.`);

  /* ---------------------------------------------------------------- */
  /* 2. Bagikan ulang nomor urut mengikuti jam, per hari               */
  /* ---------------------------------------------------------------- */
  const { rows: semua } = await kueri(
    `select id,
            nomor,
            to_char(dibuat_pada at time zone 'Asia/Jakarta', 'YYYYMMDD') as kode_hari,
            dibuat_pada
       from transaksi
      order by dibuat_pada asc`
  );

  const urutanPerHari = new Map();
  let diubah = 0;

  // Nomor sementara dulu, supaya tidak bentrok dengan nomor yang masih dipakai
  for (const t of semua) {
    await kueri('update transaksi set nomor = $1 where id = $2', [`SEMENTARA-${t.id}`, t.id]);
  }

  for (const t of semua) {
    const urut = (urutanPerHari.get(t.kode_hari) || 0) + 1;
    urutanPerHari.set(t.kode_hari, urut);

    const nomorBaru = `BB-${t.kode_hari}-${String(urut).padStart(4, '0')}`;
    await kueri('update transaksi set nomor = $1 where id = $2', [nomorBaru, t.id]);
    await kueri(
      `update log_aktivitas set nama_entitas = $1
        where entitas = 'transaksi' and entitas_id = $2`,
      [nomorBaru, t.id]
    );
    if (nomorBaru !== t.nomor) diubah++;
  }

  // Penghitung nomor harian ikut disesuaikan supaya transaksi berikutnya
  // melanjutkan dari nomor terakhir, bukan menimpa yang sudah ada.
  for (const [kodeHari, terakhir] of urutanPerHari) {
    const tanggal = `${kodeHari.slice(0, 4)}-${kodeHari.slice(4, 6)}-${kodeHari.slice(6, 8)}`;
    await kueri(
      `insert into urutan_nomor (tanggal, terakhir) values ($1::date, $2)
       on conflict (tanggal) do update set terakhir = greatest(urutan_nomor.terakhir, excluded.terakhir)`,
      [tanggal, terakhir]
    );
  }

  console.log(`2. Nomor urut dibagikan ulang mengikuti jam: ${diubah} transaksi berubah nomornya.`);

  /* ---------------------------------------------------------------- */
  /* Hasil                                                             */
  /* ---------------------------------------------------------------- */
  const { rows: periksa } = await kueri(
    `select count(*)::int as di_masa_depan from transaksi where dibuat_pada > now()`
  );
  const { rows: teratas } = await kueri(
    `select nomor, dibuat_pada from transaksi order by dibuat_pada desc limit 5`
  );

  console.log(`\nTransaksi yang jamnya masih di masa depan: ${periksa[0].di_masa_depan}`);
  console.log('\nLima transaksi teratas sekarang (nomor harus ikut menurun):');
  teratas.forEach((t) =>
    console.log(`  ${t.nomor}   ${new Date(t.dibuat_pada).toLocaleString('id-ID')}`)
  );
  console.log();
} catch (e) {
  console.error('GAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
