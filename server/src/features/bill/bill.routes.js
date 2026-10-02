import { Router } from 'express';
import { z } from 'zod';
import * as service from './bill.service.js';
import { periksa } from '../../shared/middleware/validate.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';

const router = Router();
router.use(wajibMasuk);

const skemaBuka = z.object({
  nama_pembeli: z.string().trim().min(1, 'Nama pembeli wajib diisi.').max(120),
  nomor_wa: z.string().trim().nullish(),
  penanda: z.string().trim().max(60).nullish(),
});

const skemaItem = z.object({
  jenis_barang: z.enum(['produk', 'menu']),
  barang_id: z.string().uuid(),
  jumlah: z.number().int().positive('Jumlah minimal 1.'),
});

const skemaTutup = z.object({
  diskon_jenis: z.enum(['persen', 'nominal']).nullish(),
  diskon_nilai: z.number().int().min(0).nullish(),
});

const skemaBatal = z.object({ alasan: z.string().trim().max(300).optional() });

router.get(
  '/sorotan',
  tangkap(async (_req, res) => {
    res.json({ sukses: true, data: await service.sorotan() });
  })
);

router.get(
  '/',
  tangkap(async (req, res) => {
    res.json({ sukses: true, data: await service.daftar(req.query) });
  })
);

router.get(
  '/:id',
  tangkap(async (req, res) => {
    res.json({ sukses: true, data: await service.ambil(req.params.id) });
  })
);

router.post(
  '/',
  periksa(skemaBuka),
  tangkap(async (req, res) => {
    const data = await service.buka(req.body, req.user);
    res.status(201).json({
      sukses: true,
      pesan: `Bill ${data.nomor} dibuka atas nama ${data.nama_pembeli}.`,
      data,
    });
  })
);

router.post(
  '/:id/item',
  periksa(skemaItem),
  tangkap(async (req, res) => {
    const data = await service.tambahItem(req.params.id, req.body, req.user);
    res.status(201).json({
      sukses: true,
      pesan: `${data.jumlah} ${data.nama_barang} ditambahkan. Stok langsung berkurang.`,
      data,
    });
  })
);

router.delete(
  '/:id/item/:itemId',
  tangkap(async (req, res) => {
    await service.hapusItem(req.params.id, req.params.itemId, req.user);
    res.json({ sukses: true, pesan: 'Barang dicabut dari bill, stoknya dikembalikan.' });
  })
);

router.post(
  '/:id/tutup',
  periksa(skemaTutup),
  tangkap(async (req, res) => {
    const data = await service.tutup(req.params.id, req.body, req.user);
    res.json({ sukses: true, pesan: 'Bill ditutup. Silakan lanjut ke pembayaran.', data });
  })
);

router.post(
  '/:id/batal',
  periksa(skemaBatal),
  tangkap(async (req, res) => {
    const data = await service.batal(req.params.id, req.body, req.user);
    res.json({ sukses: true, pesan: 'Bill dibatalkan, seluruh stoknya dikembalikan.', data });
  })
);

export default router;
