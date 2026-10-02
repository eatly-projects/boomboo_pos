/**
 * Mengisi daftar produk sungguhan Boomboo, sesuai berkas
 * `docs/Price List CBE.xlsx` bagian PRODUCT.
 *
 * Bagian MAKANAN di berkas itu SENGAJA belum dimasukkan, atas permintaan
 * Lutfi. Gambarnya juga tidak diambil - aplikasi ini memang tidak lagi
 * menyimpan gambar produk.
 *
 * Stok semuanya dimulai dari 0, mengikuti keputusan K7: stok hanya boleh
 * bertambah lewat halaman Stok, supaya setiap butir barang punya catatan
 * siapa yang memasukkannya dan kapan.
 *
 * Pakai: npm run seed:produk
 */
import 'dotenv/config';
import pool, { kueri, SKEMA } from '../src/shared/db/pool.js';

// Diambil apa adanya dari berkas Excel. Spasi gandanya dirapikan, dan tanda
// pemisah "|" diganti spasi supaya terbaca wajar di layar kasir.
const PRODUK = [
  { nama: 'Sambal Ikan Cakalang Daun Jeruk Level 2', harga: 48000 },
  { nama: 'Sambal Cumi Daun Jeruk Level 2', harga: 48000 },
  { nama: 'Sambal Cumi Daun Jeruk Level 4', harga: 48000 },
  { nama: 'Sambal Daun Jeruk Level 2', harga: 38000 },
  { nama: 'Sambal Daun Jeruk Level 4', harga: 43000 },
  { nama: 'Sambal Ikan Teri Daun Jeruk Level 2', harga: 48000 },
  { nama: 'Sambal Ikan Teri Daun Jeruk Level 4', harga: 48000 },
  { nama: 'Sambal Daun Jeruk Sachet Level 2', harga: 63000 },
  { nama: 'Sambal Daun Jeruk Sachet Level 4', harga: 69000 },
  { nama: 'Abon Ikan Tuna Manis Pedas', harga: 60000 },
  { nama: 'Sesame Garlic Chili Oil', harga: 60000 },
];

try {
  const { rows: cek } = await kueri(
    "select current_setting('search_path') sp, current_database() db"
  );
  if (!cek[0].sp.startsWith(SKEMA)) {
    throw new Error(`Jalur pencarian mengarah ke "${cek[0].sp}", bukan skema "${SKEMA}".`);
  }

  console.log(`\nBasis data "${cek[0].db}", skema "${SKEMA}"\n`);

  // Nama produk tidak dibatasi unik di basis data (produk lama yang diarsipkan
  // boleh bernama sama), jadi kembarannya dicari sendiri di sini supaya skrip
  // ini aman dijalankan berulang kali.
  for (const p of PRODUK) {
    const { rows: ada } = await kueri(
      'select id from produk where lower(nama) = lower($1) and diarsipkan_pada is null',
      [p.nama]
    );

    if (ada[0]) {
      await kueri('update produk set harga = $1, diubah_pada = now() where id = $2', [
        p.harga,
        ada[0].id,
      ]);
    } else {
      await kueri(
        'insert into produk (nama, harga, stok, dijual_satuan) values ($1, $2, 0, true)',
        [p.nama, p.harga]
      );
    }

    const rp = 'Rp ' + p.harga.toLocaleString('id-ID');
    console.log(`  ${ada[0] ? 'diperbarui' : 'dibuat   '}  ${p.nama.padEnd(42)} ${rp}`);
  }

  const { rows: total } = await kueri(
    'select count(*)::int n, coalesce(sum(stok),0)::int stok from produk where diarsipkan_pada is null'
  );
  console.log(`\nSelesai. ${total[0].n} produk, total stok ${total[0].stok}.`);
  console.log('Stok sengaja masih 0 - isi lewat halaman Stok supaya tercatat siapa dan kapan.\n');
} catch (e) {
  console.error('\nGAGAL:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
