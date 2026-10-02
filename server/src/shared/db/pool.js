import 'dotenv/config';
import pg from 'pg';

/**
 * Aplikasi kasir ini BERBAGI satu basis data dengan aplikasi Boomboo yang
 * lain. Supaya tidak mungkin saling menimpa, seluruh tabelnya ditaruh di
 * skema sendiri (bawaannya `pos`) dan jalur pencarian tabel dikunci ke skema
 * itu saja.
 *
 * Skema `public` sengaja TIDAK ikut dalam jalur pencarian. Akibatnya, salah
 * ketik nama tabel akan langsung menimbulkan galat, bukan diam-diam mengenai
 * tabel milik aplikasi sebelah. Skema `extensions` ikut karena isinya hanya
 * fungsi bawaan Supabase, bukan tabel aplikasi.
 */
export const SKEMA = process.env.DB_SCHEMA || 'pos';
export const OPSI_SKEMA = `-c search_path=${SKEMA},extensions`;

// Vercel menjalankan backend sebagai fungsi tanpa server, jadi banyak salinan
// bisa hidup bersamaan. Karena itu kolam sambungan sengaja dibuat kecil dan
// memakai alamat pooler Supabase (porta 6543), bukan sambungan langsung.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: OPSI_SKEMA,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (e) => {
  console.error('[db] kesalahan pada kolam sambungan:', e.message);
});

export const kueri = (teks, nilai) => pool.query(teks, nilai);

export default pool;
