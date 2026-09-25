/**
 * Memastikan bucket penyimpanan berkas di Supabase sudah ada dan bisa
 * dibaca umum (karena foto produk dan gambar QRIS ditampilkan di layar).
 *
 * Pakai:  npm run siapkan:bucket
 */
import 'dotenv/config';
import { siapkanBucket, BUCKET } from '../src/shared/storage/supabase.js';

try {
  const pesan = await siapkanBucket();
  console.log(`\n  ${pesan} dan bisa dibaca umum.\n`);
} catch (e) {
  console.error(`\n  Gagal menyiapkan bucket "${BUCKET}": ${e.message}\n`);
  process.exitCode = 1;
}
