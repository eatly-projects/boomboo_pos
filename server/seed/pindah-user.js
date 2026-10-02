/**
 * Membuat (atau memperbarui) akun pengguna aplikasi kasir.
 *
 * Dipakai saat basis datanya pindah, atau saat seluruh kata sandi perlu
 * diseragamkan sebelum tim memakainya. Akun yang emailnya sudah ada akan
 * diperbarui nama, peran, dan kata sandinya - bukan dibuat ganda.
 *
 * Kata sandinya TIDAK ditulis di berkas ini supaya tidak ikut ke GitHub.
 *
 * Pakai:
 *   npm run seed:user -- "KataSandiBaru"
 * atau:
 *   SANDI_BARU="KataSandiBaru" npm run seed:user
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool, { kueri, SKEMA } from '../src/shared/db/pool.js';

const DAFTAR_USER = [
  { nama: 'Lutfi Apriamto', email: 'lutfi_new@boomboo.id', role: 'pemilik' },
  { nama: 'Ari', email: 'ari_manager@boomboo.id', role: 'manajer' },
  { nama: 'Martin tirtawisata', email: 'martin@boomboo.id', role: 'pemilik' },
  { nama: 'Lutfi Hakim', email: 'lutfi@boomboo.id', role: 'pemilik' },
  { nama: 'Sari Wulandari', email: 'sari@boomboo.id', role: 'manajer' },
  { nama: 'Bagus Prakoso', email: 'bagus@boomboo.id', role: 'kasir' },
];

const sandi = process.argv[2] || process.env.SANDI_BARU;

if (!sandi) {
  console.error(
    '\nKata sandinya belum diisi.\n' +
      '  Pakai:  npm run seed:user -- "KataSandiBaru"\n'
  );
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(sandi, 10);
  const { rows: db } = await kueri('select current_database() d');
  console.log(`\nBasis data "${db[0].d}", skema "${SKEMA}"\n`);

  for (const u of DAFTAR_USER) {
    const { rows } = await kueri(
      `insert into users (nama, email, password_hash, role)
       values ($1, $2, $3, $4)
       on conflict (email) do update
         set nama = excluded.nama,
             role = excluded.role,
             password_hash = excluded.password_hash,
             diarsipkan_pada = null,
             diubah_pada = now()
       returning (xmax = 0) as baru`,
      [u.nama, u.email, hash, u.role]
    );
    console.log(
      `  ${rows[0].baru ? 'dibuat   ' : 'diperbarui'}  ${u.email.padEnd(26)} ${u.role}`
    );
  }

  const { rows: total } = await kueri('select count(*)::int n from users');
  console.log(`\nSelesai. ${total[0].n} akun di basis data.`);
  console.log('Seluruhnya memakai kata sandi yang baru saja diberikan.\n');
} catch (e) {
  console.error('\nGAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
