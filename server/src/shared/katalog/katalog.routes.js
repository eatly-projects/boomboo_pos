import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { periksa } from '../middleware/validate.js';
import { wajibMasuk } from '../middleware/auth.js';
import { tangkap } from '../middleware/error.js';

// Berkas ditahan di memori, tidak pernah ditulis ke cakram, karena Vercel
// menjalankan backend sebagai fungsi tanpa server yang tidak punya cakram tetap.
const unggah = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const rupiahOpsional = z
  .union([z.number().int().min(0), z.null()])
  .optional();

const skemaTambah = z
  .object({
    nama: z.string().trim().min(1, 'Nama wajib diisi.'),
    harga: z.number().int().min(0, 'Harga tidak boleh minus.'),
    harga_diskon: rupiahOpsional,
    nama_diskon: z.string().trim().min(1).nullish(),
  })
  .strict();

const skemaUbah = skemaTambah.partial();

/** Membuat kumpulan rute standar untuk satu katalog (Produk atau Menu). */
export function buatRuteKatalog(service, { label }) {
  const router = Router();
  router.use(wajibMasuk);

  router.get(
    '/',
    tangkap(async (req, res) => {
      const data = await service.daftar(req.query);
      res.json({ sukses: true, data });
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
    periksa(skemaTambah),
    tangkap(async (req, res) => {
      const data = await service.tambah(req.body, req.user);
      res.status(201).json({ sukses: true, pesan: `${label} berhasil ditambahkan.`, data });
    })
  );

  router.patch(
    '/:id',
    periksa(skemaUbah),
    tangkap(async (req, res) => {
      const data = await service.ubah(req.params.id, req.body, req.user);
      res.json({ sukses: true, pesan: `${label} berhasil diperbarui.`, data });
    })
  );

  router.delete(
    '/:id',
    tangkap(async (req, res) => {
      const data = await service.arsipkan(req.params.id, req.user);
      res.json({ sukses: true, pesan: `${label} dipindahkan ke arsip.`, data });
    })
  );

  router.post(
    '/:id/pulihkan',
    tangkap(async (req, res) => {
      const data = await service.pulihkan(req.params.id, req.user);
      res.json({ sukses: true, pesan: `${label} dikembalikan dari arsip.`, data });
    })
  );

  router.post(
    '/:id/foto',
    unggah.single('foto'),
    tangkap(async (req, res) => {
      const data = await service.simpanFoto(req.params.id, req.file, req.user);
      res.json({ sukses: true, pesan: 'Foto berhasil disimpan.', data });
    })
  );

  return router;
}
