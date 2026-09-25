import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { KesalahanAplikasi } from '../middleware/error.js';

// Pustaka Supabase di sini HANYA dipakai untuk penyimpanan berkas.
// Seluruh akses basis data memakai `pg`, supaya bisa dibungkus transaksi.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const BUCKET = process.env.SUPABASE_BUCKET || 'files';

const JENIS_GAMBAR = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
const BATAS_UKURAN = 8 * 1024 * 1024; // 8 MB

export async function unggahBerkas({ buffer, namaAsli, mimetype, folder = 'umum' }) {
  if (!buffer?.length) throw new KesalahanAplikasi('Berkasnya kosong.', 400);
  if (buffer.length > BATAS_UKURAN)
    throw new KesalahanAplikasi('Ukuran berkas maksimal 8 MB.', 400);
  if (!JENIS_GAMBAR.includes(mimetype))
    throw new KesalahanAplikasi('Berkas harus berupa gambar (JPG, PNG, WEBP).', 400);

  const ext = (path.extname(namaAsli || '') || '.jpg').toLowerCase();
  const berkas = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(berkas, buffer, { contentType: mimetype, upsert: false });

  if (error) throw new KesalahanAplikasi(`Gagal mengunggah berkas: ${error.message}`, 502);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(berkas);
  return { path: berkas, url: data.publicUrl, ukuran: buffer.length, tipe: mimetype };
}

export async function hapusBerkas(berkas) {
  if (!berkas) return;
  await supabase.storage.from(BUCKET).remove([berkas]);
}

/** Memastikan bucket-nya ada dan bisa dibaca umum. Dipanggil saat penyiapan. */
export async function siapkanBucket() {
  const { data: daftar } = await supabase.storage.listBuckets();
  const ada = daftar?.some((b) => b.name === BUCKET);
  if (!ada) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Gagal membuat bucket: ${error.message}`);
    return `bucket "${BUCKET}" dibuat`;
  }
  await supabase.storage.updateBucket(BUCKET, { public: true });
  return `bucket "${BUCKET}" sudah ada`;
}

export { BUCKET };
