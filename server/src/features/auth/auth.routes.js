import { Router } from 'express';
import { z } from 'zod';
import * as controller from './auth.controller.js';
import { periksa } from '../../shared/middleware/validate.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';

const router = Router();

const skemaDaftar = z.object({
  nama: z.string().trim().min(2, 'Nama minimal 2 huruf.'),
  email: z.string().trim().email('Format email belum benar.'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter.'),
  kode_pendaftaran: z.string().optional(),
});

const skemaMasuk = z.object({
  email: z.string().trim().email('Format email belum benar.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

const skemaGantiPassword = z.object({
  password_lama: z.string().min(1, 'Kata sandi lama wajib diisi.'),
  password_baru: z.string().min(6, 'Kata sandi baru minimal 6 karakter.'),
});

router.post('/daftar', periksa(skemaDaftar), tangkap(controller.daftar));
router.post('/masuk', periksa(skemaMasuk), tangkap(controller.masuk));
router.get('/saya', wajibMasuk, tangkap(controller.saya));
router.post(
  '/ganti-password',
  wajibMasuk,
  periksa(skemaGantiPassword),
  tangkap(controller.gantiPassword)
);

export default router;
