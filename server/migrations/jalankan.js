// Menjalankan berkas .sql di folder ini secara berurutan, dan mencatat mana
// yang sudah pernah dijalankan supaya tidak diulang.
// Pakai: npm run migrate
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const folder = path.dirname(fileURLToPath(import.meta.url));

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
  console.log('Tersambung ke basis data.\n');

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
      `select to_regclass('public.transaksi') as ada`
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
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`
  );
  console.log(`\n${dijalankan} berkas baru dijalankan.`);
  console.log(`Tabel sekarang (${tabel.length}):`);
  console.log('  ' + tabel.map((r) => r.table_name).join(', '));
} catch (e) {
  console.error('\nGAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
