/**
 * Merapikan jam transaksi contoh untuk HARI INI.
 *
 * Saat data contoh dibuat, tiap transaksi diberi jam acak antara pukul 10
 * sampai 20. Untuk hari-hari yang sudah lewat itu tidak masalah, tapi untuk
 * hari ini sebagian jamnya jadi berada di masa depan. Akibatnya transaksi
 * sungguhan yang baru dibuat justru tenggelam di bawah transaksi contoh.
 *
 * Skrip ini menyebar ulang transaksi hari ini dari pukul 10.00 sampai lima
 * menit yang lalu, dengan urutan yang tetap sama.
 *
 * Pakai:  npm run rapikan:jam
 */
import 'dotenv/config';
import pool, { kueri } from '../src/shared/db/pool.js';

const WIB = 7 * 60 * 60 * 1000;

try {
  const sekarang = new Date();
  const batasAkhir = new Date(sekarang.getTime() - 5 * 60 * 1000);

  // Awal hari ini menurut waktu Jakarta, lalu dimulai dari pukul 10.00
  const hariIniWib = new Date(sekarang.getTime() + WIB);
  const mulai = new Date(
    Date.UTC(
      hariIniWib.getUTCFullYear(),
      hariIniWib.getUTCMonth(),
      hariIniWib.getUTCDate(),
      10 - 7 // pukul 10.00 WIB
    )
  );

  const { rows } = await kueri(
    `select id, dibuat_pada, dikonfirmasi_pada, dibatalkan_pada
       from transaksi
      where (dibuat_pada at time zone 'Asia/Jakarta')::date
            = (now() at time zone 'Asia/Jakarta')::date
      order by dibuat_pada asc`
  );

  if (rows.length === 0) {
    console.log('\nTidak ada transaksi hari ini. Tidak ada yang perlu dirapikan.\n');
  } else {
    const rentang = batasAkhir.getTime() - mulai.getTime();
    const jarak = rentang / (rows.length + 1);
    let dirapikan = 0;

    for (let i = 0; i < rows.length; i++) {
      const t = rows[i];
      const baru = new Date(mulai.getTime() + jarak * (i + 1));
      if (new Date(t.dibuat_pada).getTime() <= batasAkhir.getTime()) {
        // sudah wajar, tapi tetap disebar supaya urutannya rapi
      }
      const selesai = new Date(baru.getTime() + 60 * 1000);

      await kueri(
        `update transaksi
            set dibuat_pada = $1::timestamptz,
                dikonfirmasi_pada = case when dikonfirmasi_pada is null then null else $2::timestamptz end,
                dibatalkan_pada   = case when dibatalkan_pada   is null then null else $2::timestamptz end
          where id = $3`,
        [baru, selesai, t.id]
      );
      await kueri('update pergerakan_stok set dibuat_pada = $1 where transaksi_id = $2', [
        selesai,
        t.id,
      ]);
      await kueri(
        `update log_aktivitas set dibuat_pada = $1 where entitas = 'transaksi' and entitas_id = $2`,
        [selesai, t.id]
      );
      dirapikan++;
    }

    console.log(`\n${dirapikan} transaksi hari ini disebar ulang.`);
  }

  const { rows: periksa } = await kueri(
    `select count(*)::int as di_masa_depan from transaksi where dibuat_pada > now()`
  );
  const { rows: teratas } = await kueri(
    `select nomor, dibuat_pada from transaksi order by dibuat_pada desc limit 3`
  );

  console.log(`Transaksi yang jamnya masih di masa depan: ${periksa[0].di_masa_depan}`);
  console.log('\nTiga transaksi teratas sekarang:');
  teratas.forEach((t) =>
    console.log(`  ${t.nomor}  ${new Date(t.dibuat_pada).toLocaleString('id-ID')}`)
  );
  console.log();
} catch (e) {
  console.error('GAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
