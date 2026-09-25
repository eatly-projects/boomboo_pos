import { kueri } from '../../shared/db/pool.js';
import { unggahBerkas, hapusBerkas } from '../../shared/storage/supabase.js';
import { catatLog } from '../../shared/utils/log.js';
import { halaman } from '../../shared/utils/bantu.js';
import { KesalahanAplikasi, tidakDitemukan } from '../../shared/middleware/error.js';

/**
 * Bagian Media: tempat menyimpan bukti bayar QRIS.
 *
 * Sesuai keputusan K20, berkas di sini BERDIRI SENDIRI - tidak menempel ke
 * transaksi tertentu. Supaya tetap bisa dicocokkan secara kasar kalau ada
 * selisih uang, setiap berkas otomatis mencatat tanggal, jam, dan siapa
 * yang mengunggahnya.
 */

export async function daftar(query = {}) {
  const { perHalaman, halamanKe, lewati } = halaman({ per_halaman: 50, ...query });
  const syarat = [];
  const nilai = [];

  if (query.tanggal_dari) {
    nilai.push(query.tanggal_dari);
    syarat.push(`diunggah_pada >= $${nilai.length}::date`);
  }
  if (query.tanggal_sampai) {
    nilai.push(query.tanggal_sampai);
    syarat.push(`diunggah_pada < ($${nilai.length}::date + interval '1 day')`);
  }
  // Penyaring siapa yang mengunggah. Menerima id user maupun namanya,
  // supaya bisa dipakai dari kotak pilihan maupun dari tautan langsung.
  if (query.diunggah_oleh_id) {
    nilai.push(query.diunggah_oleh_id);
    syarat.push(`diunggah_oleh_id = $${nilai.length}`);
  }
  if (query.nama_pengunggah) {
    nilai.push(query.nama_pengunggah);
    syarat.push(`nama_pengunggah = $${nilai.length}`);
  }
  if (query.cari) {
    nilai.push(`%${query.cari}%`);
    syarat.push(
      `(nama_berkas ilike $${nilai.length} or catatan ilike $${nilai.length} or nama_pengunggah ilike $${nilai.length})`
    );
  }
  const where = syarat.length ? `where ${syarat.join(' and ')}` : '';

  const { rows } = await kueri(
    `select * from media ${where} order by diunggah_pada desc
      limit $${nilai.length + 1} offset $${nilai.length + 2}`,
    [...nilai, perHalaman, lewati]
  );
  const { rows: hitung } = await kueri(`select count(*)::int as total from media ${where}`, nilai);

  return {
    daftar: rows,
    halaman: { halaman: halamanKe, per_halaman: perHalaman, total: hitung[0].total },
  };
}

/**
 * Daftar orang yang pernah mengunggah bukti bayar, lengkap dengan berapa
 * banyak berkas dan kapan terakhir kali. Dipakai untuk mengisi kotak
 * pilihan penyaring, sekaligus sebagai ringkasan siapa mengerjakan apa.
 */
export async function pengunggah() {
  const { rows } = await kueri(
    `select diunggah_oleh_id,
            nama_pengunggah,
            count(*)::int      as jumlah_berkas,
            max(diunggah_pada) as terakhir_pada
       from media
      group by diunggah_oleh_id, nama_pengunggah
      order by jumlah_berkas desc, nama_pengunggah asc`
  );
  return rows;
}

export async function unggah(berkasBerkas, catatan, user) {
  if (!berkasBerkas?.length)
    throw new KesalahanAplikasi('Belum ada gambar yang dipilih.', 400);

  const hasil = [];
  for (const b of berkasBerkas) {
    const naik = await unggahBerkas({
      buffer: b.buffer,
      namaAsli: b.originalname,
      mimetype: b.mimetype,
      folder: 'bukti-bayar',
    });

    const { rows } = await kueri(
      `insert into media
         (nama_berkas, path_berkas, url, ukuran_byte, tipe_berkas, catatan,
          diunggah_oleh_id, nama_pengunggah)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`,
      [
        b.originalname,
        naik.path,
        naik.url,
        naik.ukuran,
        naik.tipe,
        catatan || null,
        user.id,
        user.nama,
      ]
    );
    hasil.push(rows[0]);
  }

  await catatLog({
    user,
    aksi: 'unggah_media',
    entitas: 'media',
    detail: { jumlah_berkas: hasil.length, catatan: catatan || null },
  });

  return hasil;
}

export async function hapus(id, user) {
  const { rows } = await kueri('select * from media where id = $1', [id]);
  const berkas = rows[0];
  if (!berkas) throw tidakDitemukan('Berkas tidak ditemukan.');

  await hapusBerkas(berkas.path_berkas).catch(() => {});
  await kueri('delete from media where id = $1', [id]);

  await catatLog({
    user,
    aksi: 'hapus_media',
    entitas: 'media',
    entitasId: id,
    namaEntitas: berkas.nama_berkas,
  });
  return true;
}
