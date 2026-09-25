import 'dotenv/config';
import pg from 'pg';

// Vercel menjalankan backend sebagai fungsi tanpa server, jadi banyak salinan
// bisa hidup bersamaan. Karena itu kolam sambungan sengaja dibuat kecil dan
// memakai alamat pooler Supabase (porta 6543), bukan sambungan langsung.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
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
