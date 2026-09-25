import { Router } from 'express';
import { kueri } from '../../shared/db/pool.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';
import { halaman } from '../../shared/utils/bantu.js';

const router = Router();
router.use(wajibMasuk);

/** Semua jenis aksi yang pernah tercatat - dipakai untuk isi kotak penyaring. */
router.get(
  '/pilihan',
  tangkap(async (_req, res) => {
    const { rows: aksi } = await kueri(
      'select distinct aksi from log_aktivitas order by aksi'
    );
    const { rows: entitas } = await kueri(
      'select distinct entitas from log_aktivitas order by entitas'
    );
    const { rows: user } = await kueri(
      'select distinct nama_user from log_aktivitas order by nama_user'
    );
    res.json({
      sukses: true,
      data: {
        aksi: aksi.map((a) => a.aksi),
        entitas: entitas.map((e) => e.entitas),
        user: user.map((u) => u.nama_user),
      },
    });
  })
);

router.get(
  '/',
  tangkap(async (req, res) => {
    const { perHalaman, halamanKe, lewati } = halaman({ per_halaman: 50, ...req.query });
    const syarat = [];
    const nilai = [];

    const tambah = (teks, isi) => {
      nilai.push(isi);
      syarat.push(teks.replace('$?', `$${nilai.length}`));
    };

    if (req.query.aksi) tambah('aksi = $?', req.query.aksi);
    if (req.query.entitas) tambah('entitas = $?', req.query.entitas);
    if (req.query.entitas_id) tambah('entitas_id = $?', req.query.entitas_id);
    if (req.query.user_id) tambah('user_id = $?', req.query.user_id);
    if (req.query.nama_user) tambah('nama_user = $?', req.query.nama_user);
    if (req.query.cari) tambah('nama_entitas ilike $?', `%${req.query.cari}%`);
    if (req.query.tanggal_dari) tambah('dibuat_pada >= $?::date', req.query.tanggal_dari);
    if (req.query.tanggal_sampai)
      tambah("dibuat_pada < ($?::date + interval '1 day')", req.query.tanggal_sampai);

    const where = syarat.length ? `where ${syarat.join(' and ')}` : '';

    const { rows } = await kueri(
      `select * from log_aktivitas ${where}
        order by dibuat_pada desc
        limit $${nilai.length + 1} offset $${nilai.length + 2}`,
      [...nilai, perHalaman, lewati]
    );
    const { rows: hitung } = await kueri(
      `select count(*)::int as total from log_aktivitas ${where}`,
      nilai
    );

    res.json({
      sukses: true,
      data: {
        daftar: rows,
        halaman: { halaman: halamanKe, per_halaman: perHalaman, total: hitung[0].total },
      },
    });
  })
);

export default router;
