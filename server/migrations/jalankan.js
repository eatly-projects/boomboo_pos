// Menjalankan berkas .sql di folder ini secara berurutan, dan mencatat mana
// yang sudah pernah dijalankan supaya tidak diulang.
//
// Seluruh tabel dibuat di dalam skema sendiri (bawaannya `pos`), karena basis
// datanya dipakai bersama aplikasi Boomboo yang lain. Lihat src/shared/db/pool.js.
//
// Pakai: npm run migrate
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const folder = path.dirname(fileURLToPath(import.meta.url));
const SKEMA = process.env.DB_SCHEMA || 'pos';

// Nama skema dipakai langsung di dalam perintah SQL, jadi dibatasi ketat.
if (!/^[a-z_][a-z0-9_]*$/.test(SKEMA)) {
  console.error(`GAGAL: nama skema "${SKEMA}" tidak sah.`);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const berkas = fs
  .readdirSync(folder)
  .filter((f) => f.endsWith('.sql'))
  .sort();

try {
  await client.connect();
  const { rows: info } = await client.query('select current_database() db');
  console.log(`Tersambung ke basis data "${info[0].db}", skema "${SKEMA}".\n`);

  // Skemanya dibuat lebih dulu, baru jalur pencarian diarahkan ke situ.
  // Urutannya penting: kalau skemanya belum ada, tabel baru akan jatuh ke
  // skema lain yang kebetulan ada di jalur pencarian.
  await client.query(`create schema if not exists ${SKEMA}`);
  await client.query(`set search_path to ${SKEMA}, extensions`);

  const { rows: cek } = await client.query("select current_setting('search_path') v");
  if (!cek[0].v.startsWith(SKEMA)) {
    throw new Error(`Jalur pencarian tidak mengarah ke skema ${SKEMA}, melainkan ${cek[0].v}.`);
  }

  await client.query(`
    create table if not exists migrasi_terpasang (
      berkas       text primary key,
      dipasang_pada timestamptz not null default now()
    )
  `);

  const { rows } = await client.query('select berkas from migrasi_terpasang');
  const sudah = new Set(rows.map((r) => r.berkas));

  // Berkas pertama mungkin sudah pernah dijalankan sebelum tabel pencatat ini
  // ada. Kalau tabel intinya sudah terbentuk, anggap saja sudah terpasang.
  if (sudah.size === 0) {
    const { rows: adaTabel } = await client.query(
      `select to_regclass($1) as ada`,
      [`${SKEMA}.transaksi`]
    );
    if (adaTabel[0].ada) {
      await client.query(
        'insert into migrasi_terpasang (berkas) values ($1) on conflict do nothing',
        [berkas[0]]
      );
      sudah.add(berkas[0]);
      console.log(`  ${berkas[0]} dianggap sudah terpasang (tabelnya sudah ada)\n`);
    }
  }

  let dijalankan = 0;
  for (const nama of berkas) {
    if (sudah.has(nama)) {
      console.log(`  lewati     ${nama}  (sudah pernah dijalankan)`);
      continue;
    }
    process.stdout.write(`  menjalankan ${nama} ... `);
    await client.query('BEGIN');
    try {
      // Ditegaskan lagi di dalam transaksinya, supaya berkas .sql yang sempat
      // mengubah jalur pencarian tidak bisa membuat tabel nyasar ke skema lain.
      await client.query(`set local search_path to ${SKEMA}, extensions`);
      await client.query(fs.readFileSync(path.join(folder, nama), 'utf8'));
      await client.query('insert into migrasi_terpasang (berkas) values ($1)', [nama]);
      await client.query('COMMIT');
      console.log('selesai');
      dijalankan++;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }

  const { rows: tabel } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = $1 and table_type = 'BASE TABLE'
      order by table_name`,
    [SKEMA]
  );
  console.log(`\n${dijalankan} berkas baru dijalankan.`);
  console.log(`Tabel di skema ${SKEMA} (${tabel.length}):`);
  console.log('  ' + tabel.map((r) => r.table_name).join(', '));
} catch (e) {
  console.error('\nGAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
