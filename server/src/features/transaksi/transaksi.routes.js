import { Router } from 'express';
import { z } from 'zod';
import * as service from './transaksi.service.js';
import { periksa } from '../../shared/middleware/validate.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';

const router = Router();
router.use(wajibMasuk);

const skemaBuat = z
  .object({
    item: z
      .array(
        z.object({
          jenis_barang: z.enum(['produk', 'menu']),
          barang_id: z.string().uuid(),
          jumlah: z.number().int().positive('Jumlah minimal 1.'),
        })
      )
      .min(1, 'Keranjang masih kosong.'),
    diskon_jenis: z.enum(['persen', 'nominal']).nullish(),
    diskon_nilai: z.number().int().min(0).nullish(),
  })
  .refine(
    (d) => !d.diskon_nilai || d.diskon_jenis,
    { message: 'Pilih dulu jenis diskonnya: persentase atau potongan rupiah.' }
  )
  .refine(
    (d) => d.diskon_jenis !== 'persen' || (d.diskon_nilai ?? 0) <= 100,
    { message: 'Diskon persentase tidak boleh lebih dari 100%.' }
  );

const skemaKonfirmasi = z.object({
  metode_bayar: z.enum(['qris', 'tunai'], {
    errorMap: () => ({ message: 'Pilih metode pembayaran: QRIS atau Tunai.' }),
  }),
  uang_diterima: z.number().int().min(0).nullish(),
});

const skemaBatal = z.object({
  alasan: z.string().trim().max(300).optional(),
});

const skemaPembeli = z.object({
  nama_pembeli: z.string().trim().max(120).nullish(),
  nomor_wa: z.string().trim().nullish(),
});

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
  periksa(skemaBuat),
  tangkap(async (req, res) => {
    const data = await service.buat(req.body, req.user);
    res.status(201).json({ sukses: true, pesan: 'Silakan lanjut ke pembayaran.', data });
  })
);

router.post(
  '/:id/konfirmasi',
  periksa(skemaKonfirmasi),
  tangkap(async (req, res) => {
    const data = await service.konfirmasi(req.params.id, req.body, req.user);
    res.json({
      sukses: true,
      pesan: data.ditandai_stok_kurang
        ? 'Pembayaran dikonfirmasi, tetapi ada produk yang stoknya jadi kurang. Segera periksa.'
        : 'Pembayaran berhasil dikonfirmasi.',
      data,
    });
  })
);

router.post(
  '/:id/batal',
  periksa(skemaBatal),
  tangkap(async (req, res) => {
    const data = await service.batal(req.params.id, req.body, req.user);
    res.json({ sukses: true, pesan: 'Transaksi dibatalkan.', data });
  })
);

router.patch(
  '/:id/pembeli',
  periksa(skemaPembeli),
  tangkap(async (req, res) => {
    const data = await service.isiPembeli(req.params.id, req.body, req.user);
    res.json({ sukses: true, pesan: 'Data pembeli tersimpan.', data });
  })
);

router.post(
  '/:id/lewati-struk',
  tangkap(async (req, res) => {
    const data = await service.lewatiStruk(req.params.id);
    res.json({ sukses: true, pesan: 'Pengiriman struk dilewati.', data });
  })
);

export default router;
