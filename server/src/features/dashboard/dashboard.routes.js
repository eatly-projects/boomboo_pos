import { Router } from 'express';
import * as service from './dashboard.service.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';

const router = Router();
router.use(wajibMasuk);

router.get('/sorotan', tangkap(async (_req, res) => {
  res.json({ sukses: true, data: await service.sorotan() });
}));

router.get('/ringkasan', tangkap(async (req, res) => {
  res.json({ sukses: true, data: await service.ringkasan(req.query) });
}));

router.get('/harian', tangkap(async (req, res) => {
  res.json({ sukses: true, data: await service.harian(req.query) });
}));

router.get('/per-jam', tangkap(async (req, res) => {
  res.json({ sukses: true, data: await service.perJam(req.query) });
}));

router.get('/terlaris', tangkap(async (req, res) => {
  res.json({ sukses: true, data: await service.terlaris(req.query) });
}));

router.get('/per-kasir', tangkap(async (req, res) => {
  res.json({ sukses: true, data: await service.perKasir(req.query) });
}));

router.get('/stok-keluar', tangkap(async (req, res) => {
  res.json({ sukses: true, data: await service.stokKeluarBukanJualan(req.query) });
}));

router.get('/pengembalian-uang', tangkap(async (req, res) => {
  res.json({ sukses: true, data: await service.pengembalianUang(req.query) });
}));

/** Semua angka dashboard dalam satu panggilan, supaya layar cepat terisi. */
router.get('/', tangkap(async (req, res) => {
  const [sorotan, ringkasan, harian, terlaris, perKasir, stokKeluar, pengembalian] =
    await Promise.all([
      service.sorotan(),
      service.ringkasan(req.query),
      service.harian(req.query),
      service.terlaris(req.query),
      service.perKasir(req.query),
      service.stokKeluarBukanJualan(req.query),
      service.pengembalianUang(req.query),
    ]);
  res.json({
    sukses: true,
    data: {
      sorotan, ringkasan, harian, terlaris,
      per_kasir: perKasir,
      stok_keluar: stokKeluar,
      pengembalian_uang: pengembalian,
    },
  });
}));

export default router;
