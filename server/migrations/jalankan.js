// Menjalankan seluruh berkas .sql di folder ini secara berurutan.
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

  for (const nama of berkas) {
    const isi = fs.readFileSync(path.join(folder, nama), 'utf8');
    process.stdout.write(`  menjalankan ${nama} ... `);
    await client.query(isi);
    console.log('selesai');
  }

  const { rows } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`
  );
  console.log(`\nTabel yang ada sekarang (${rows.length}):`);
  console.log('  ' + rows.map((r) => r.table_name).join(', '));
} catch (e) {
  console.error('\nGAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
