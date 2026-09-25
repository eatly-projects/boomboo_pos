import { Router } from 'express';
import multer from 'multer';
import * as service from './media.service.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';

const unggah = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 20 },
});

const router = Router();
router.use(wajibMasuk);

// Didaftarkan sebelum jalur lain supaya tidak tertukar dengan id berkas.
router.get(
  '/pengunggah',
  tangkap(async (_req, res) => {
    res.json({ sukses: true, data: await service.pengunggah() });
  })
);

router.get(
  '/',
  tangkap(async (req, res) => {
    res.json({ sukses: true, data: await service.daftar(req.query) });
  })
);

router.post(
  '/',
  unggah.array('berkas', 20),
  tangkap(async (req, res) => {
    const data = await service.unggah(req.files, req.body?.catatan, req.user);
    res.status(201).json({
      sukses: true,
      pesan: `${data.length} berkas berhasil diunggah.`,
      data,
    });
  })
);

router.delete(
  '/:id',
  tangkap(async (req, res) => {
    await service.hapus(req.params.id, req.user);
    res.json({ sukses: true, pesan: 'Berkas dihapus.' });
  })
);

export default router;
