import { Router } from 'express';
import { z } from 'zod';
import * as service from './stok.service.js';
import { periksa } from '../../shared/middleware/validate.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';
import { ALASAN_PENGURANGAN } from '../../shared/stok/pergerakan.js';

const router = Router();
router.use(wajibMasuk);

const skemaTambah = z.object({
  jumlah: z.number().int().positive('Jumlah harus lebih dari 0.'),
  catatan: z.string().trim().max(300).optional(),
});

const skemaKurang = z.object({
  jumlah: z.number().int().positive('Jumlah harus lebih dari 0.'),
  alasan: z.string().trim().min(1, 'Alasan pengurangan wajib diisi.'),
  catatan: z.string().trim().max(300).optional(),
});

const skemaOpname = z.object({
  hitungan: z
    .array(
      z.object({
        produk_id: z.string().uuid(),
        jumlah_fisik: z.number().int().min(0, 'Jumlah fisik tidak boleh minus.'),
        catatan: z.string().trim().max(300).optional(),
      })
    )
    .min(1, 'Belum ada produk yang dihitung.'),
});

router.get(
  '/',
  tangkap(async (req, res) => {
    res.json({ sukses: true, data: await service.ringkasan(req.query) });
  })
);

router.get(
  '/alasan',
  tangkap(async (_req, res) => {
    res.json({ sukses: true, data: ALASAN_PENGURANGAN });
  })
);

router.get(
  '/:produkId/kartu',
  tangkap(async (req, res) => {
    res.json({ sukses: true, data: await service.kartu(req.params.produkId, req.query) });
  })
);

router.post(
  '/:produkId/tambah',
  periksa(skemaTambah),
  tangkap(async (req, res) => {
    const data = await service.tambah(req.params.produkId, req.body, req.user);
    res.json({
      sukses: true,
      pesan: `Stok ${data.nama_produk} bertambah menjadi ${data.stok_sesudah}.`,
      data,
    });
  })
);

router.post(
  '/:produkId/kurang',
  periksa(skemaKurang),
  tangkap(async (req, res) => {
    const data = await service.kurang(req.params.produkId, req.body, req.user);
    res.json({
      sukses: true,
      pesan: `Stok ${data.nama_produk} berkurang menjadi ${data.stok_sesudah}.`,
      data,
    });
  })
);

router.post(
  '/opname',
  periksa(skemaOpname),
  tangkap(async (req, res) => {
    const data = await service.opname(req.body.hitungan, req.user);
    const berubah = data.filter((d) => d.berubah).length;
    res.json({
      sukses: true,
      pesan: `Stok opname selesai. ${data.length} produk dihitung, ${berubah} disesuaikan.`,
      data,
    });
  })
);

export default router;
