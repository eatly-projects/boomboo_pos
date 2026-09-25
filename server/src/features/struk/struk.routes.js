import { Router } from 'express';
import * as service from './struk.service.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';

const router = Router();

// Jalur publik sengaja diberi awalan `/publik` supaya tidak bentrok dengan
// jalur `/antrian` dan `/kontak` di bawahnya.
router.get(
  '/publik/:kode',
  tangkap(async (req, res) => {
    res.json({ sukses: true, data: await service.publik(req.params.kode) });
  })
);

router.get(
  '/antrian',
  wajibMasuk,
  tangkap(async (req, res) => {
    res.json({ sukses: true, data: await service.antrian(req.query) });
  })
);

router.get(
  '/kontak',
  wajibMasuk,
  tangkap(async (req, res) => {
    res.json({ sukses: true, data: await service.kontak(req.query) });
  })
);

router.post(
  '/:id/tandai-terkirim',
  wajibMasuk,
  tangkap(async (req, res) => {
    const data = await service.tandaiTerkirim(req.params.id);
    res.json({ sukses: true, pesan: 'Struk ditandai sudah terkirim.', data });
  })
);

export default router;
