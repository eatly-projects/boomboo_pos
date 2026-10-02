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

// Hanya akun inti. Kasir tambahan dibuat langsung lewat halaman Pengguna,
// dan kata sandinya tetap ikut diseragamkan oleh skrip ini.
const DAFTAR_USER = [
  { nama: 'Lutfi Apriamto', email: 'lutfi_new@boomboo.id', role: 'pemilik' },
  { nama: 'Ari', email: 'ari_manager@boomboo.id', role: 'manajer' },
  { nama: 'Martin', email: 'martin@boomboo.id', role: 'pemilik' },
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

  // Akun inti dipastikan ada. Nama dan perannya SENGAJA tidak ditimpa kalau
  // akunnya sudah ada, karena keduanya diatur lewat halaman Pengguna di
  // aplikasi. Kalau ditimpa, perubahan yang dibuat di sana akan terhapus
  // diam-diam setiap kali skrip ini dijalankan.
  for (const u of DAFTAR_USER) {
    const { rows } = await kueri(
      `insert into users (nama, email, password_hash, role)
       values ($1, $2, $3, $4)
       on conflict (email) do update
         set password_hash = excluded.password_hash,
             diarsipkan_pada = null,
             diubah_pada = now()
       returning (xmax = 0) as baru, nama, role`,
      [u.nama, u.email, hash, u.role]
    );
    console.log(
      `  ${rows[0].baru ? 'dibuat   ' : 'sandi diganti'}  ${u.email.padEnd(26)} ${rows[0].role}`
    );
  }

  // Akun lain yang dibuat lewat halaman Pengguna ikut diseragamkan sandinya.
  const daftarInti = DAFTAR_USER.map((u) => u.email);
  const { rows: lainnya } = await kueri(
    `update users set password_hash = $1, diubah_pada = now()
      where email <> all($2)
      returning nama, email, role`,
    [hash, daftarInti]
  );
  for (const u of lainnya) {
    console.log(`  sandi diganti  ${u.email.padEnd(26)} ${u.role}`);
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
