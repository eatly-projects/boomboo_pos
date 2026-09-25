// Pintu masuk untuk Vercel.
//
// Di Vercel, Express tidak dijalankan sebagai server yang terus hidup,
// melainkan sebagai fungsi yang dipanggil per permintaan. Karena itu di sini
// aplikasinya cukup diekspor, tanpa app.listen().
import app from '../src/app.js';

export default app;
