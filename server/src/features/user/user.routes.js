import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { kueri } from '../../shared/db/pool.js';
import { periksa } from '../../shared/middleware/validate.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap, KesalahanAplikasi, tidakDitemukan } from '../../shared/middleware/error.js';
import { catatLog } from '../../shared/utils/log.js';

const router = Router();
router.use(wajibMasuk);

const KOLOM = 'id, nama, email, role, dibuat_pada, diubah_pada, diarsipkan_pada';
const ROLE = ['pemilik', 'manajer', 'kasir'];

const skemaTambah = z.object({
  nama: z.string().trim().min(2, 'Nama minimal 2 huruf.'),
  email: z.string().trim().email('Format email belum benar.'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter.'),
  role: z.enum(ROLE).default('kasir'),
});

const skemaUbah = z.object({
  nama: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(ROLE).optional(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter.').optional(),
});

router.get(
  '/peran',
  tangkap(async (_req, res) => {
    // Untuk sekarang semua peran punya hak yang sama persis (keputusan K19).
    // Nilainya tetap disimpan supaya pembatasan tinggal diaktifkan nanti.
    res.json({ sukses: true, data: ROLE });
  })
);

router.get(
  '/',
  tangkap(async (req, res) => {
    const where =
      req.query.termasuk_arsip === 'true' ? '' : 'where diarsipkan_pada is null';
    const { rows } = await kueri(`select ${KOLOM} from users ${where} order by nama asc`);
    res.json({ sukses: true, data: rows });
  })
);

router.post(
  '/',
  periksa(skemaTambah),
  tangkap(async (req, res) => {
    const email = req.body.email.toLowerCase();
    const { rows: ada } = await kueri('select id from users where email = $1', [email]);
    if (ada.length) throw new KesalahanAplikasi('Email ini sudah terdaftar.', 409);

    const hash = await bcrypt.hash(req.body.password, 10);
    const { rows } = await kueri(
      `insert into users (nama, email, password_hash, role)
       values ($1,$2,$3,$4) returning ${KOLOM}`,
      [req.body.nama.trim(), email, hash, req.body.role]
    );

    await catatLog({
      user: req.user,
      aksi: 'tambah_user',
      entitas: 'user',
      entitasId: rows[0].id,
      namaEntitas: rows[0].nama,
      detail: { email, role: req.body.role, cara: 'dibuat dari dalam aplikasi' },
    });

    res.status(201).json({ sukses: true, pesan: 'User berhasil ditambahkan.', data: rows[0] });
  })
);

router.patch(
  '/:id',
  periksa(skemaUbah),
  tangkap(async (req, res) => {
    const { rows: lama } = await kueri('select * from users where id = $1', [req.params.id]);
    if (!lama[0]) throw tidakDitemukan('User tidak ditemukan.');

    const nama = req.body.nama?.trim() ?? lama[0].nama;
    const email = req.body.email?.toLowerCase() ?? lama[0].email;
    const role = req.body.role ?? lama[0].role;
    const hash = req.body.password
      ? await bcrypt.hash(req.body.password, 10)
      : lama[0].password_hash;

    const { rows } = await kueri(
      `update users set nama=$1, email=$2, role=$3, password_hash=$4
        where id=$5 returning ${KOLOM}`,
      [nama, email, role, hash, req.params.id]
    );

    const berubah = [];
    if (nama !== lama[0].nama) berubah.push('nama');
    if (email !== lama[0].email) berubah.push('email');
    if (role !== lama[0].role) berubah.push('peran');
    if (req.body.password) berubah.push('kata sandi');

    await catatLog({
      user: req.user,
      aksi: 'ubah_user',
      entitas: 'user',
      entitasId: req.params.id,
      namaEntitas: nama,
      detail: { yang_diubah: berubah },
    });

    res.json({ sukses: true, pesan: 'Data user diperbarui.', data: rows[0] });
  })
);

router.delete(
  '/:id',
  tangkap(async (req, res) => {
    if (req.params.id === req.user.id)
      throw new KesalahanAplikasi('Anda tidak bisa menonaktifkan akun sendiri.', 400);

    const { rows } = await kueri(
      `update users set diarsipkan_pada = now() where id=$1 returning ${KOLOM}`,
      [req.params.id]
    );
    if (!rows[0]) throw tidakDitemukan('User tidak ditemukan.');

    await catatLog({
      user: req.user,
      aksi: 'arsip_user',
      entitas: 'user',
      entitasId: req.params.id,
      namaEntitas: rows[0].nama,
    });

    res.json({ sukses: true, pesan: 'User dinonaktifkan.', data: rows[0] });
  })
);

router.post(
  '/:id/pulihkan',
  tangkap(async (req, res) => {
    const { rows } = await kueri(
      `update users set diarsipkan_pada = null where id=$1 returning ${KOLOM}`,
      [req.params.id]
    );
    if (!rows[0]) throw tidakDitemukan('User tidak ditemukan.');
    await catatLog({
      user: req.user,
      aksi: 'pulihkan_user',
      entitas: 'user',
      entitasId: req.params.id,
      namaEntitas: rows[0].nama,
    });
    res.json({ sukses: true, pesan: 'User diaktifkan kembali.', data: rows[0] });
  })
);

export default router;
