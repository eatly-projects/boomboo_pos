import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { kueri } from '../../shared/db/pool.js';
import { unggahBerkas, hapusBerkas } from '../../shared/storage/supabase.js';
import { periksa } from '../../shared/middleware/validate.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap, KesalahanAplikasi } from '../../shared/middleware/error.js';
import { catatLog } from '../../shared/utils/log.js';

const unggah = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const router = Router();
router.use(wajibMasuk);

// Kunci yang boleh diubah lewat aplikasi
const KUNCI_BOLEH = ['nama_toko', 'teks_struk_bawah', 'kode_pendaftaran'];

async function bacaSemua() {
  const { rows } = await kueri('select * from pengaturan order by kunci');
  return Object.fromEntries(rows.map((r) => [r.kunci, r.nilai]));
}

async function simpan(kunci, nilai, user) {
  await kueri(
    `insert into pengaturan (kunci, nilai, diubah_oleh_id, nama_pengubah, diubah_pada)
     values ($1,$2,$3,$4, now())
     on conflict (kunci) do update
        set nilai = excluded.nilai,
            diubah_oleh_id = excluded.diubah_oleh_id,
            nama_pengubah = excluded.nama_pengubah,
            diubah_pada = now()`,
    [kunci, nilai, user.id, user.nama]
  );
}

router.get(
  '/',
  tangkap(async (_req, res) => {
    res.json({ sukses: true, data: await bacaSemua() });
  })
);

router.put(
  '/:kunci',
  periksa(z.object({ nilai: z.string().trim().max(500).nullish() })),
  tangkap(async (req, res) => {
    const { kunci } = req.params;
    if (!KUNCI_BOLEH.includes(kunci))
      throw new KesalahanAplikasi('Pengaturan ini tidak bisa diubah dari sini.', 400);

    const { rows: lama } = await kueri('select nilai from pengaturan where kunci = $1', [kunci]);
    const nilaiBaru = req.body.nilai?.trim() || null;
    await simpan(kunci, nilaiBaru, req.user);

    await catatLog({
      user: req.user,
      aksi: 'ubah_pengaturan',
      entitas: 'pengaturan',
      namaEntitas: kunci,
      detail: {
        // nilai kode pendaftaran sengaja tidak ikut dicatat isinya
        sebelum: kunci === 'kode_pendaftaran' ? '(disembunyikan)' : lama[0]?.nilai ?? null,
        sesudah: kunci === 'kode_pendaftaran' ? '(disembunyikan)' : nilaiBaru,
      },
    });

    res.json({ sukses: true, pesan: 'Pengaturan disimpan.', data: await bacaSemua() });
  })
);

/** Mengunggah atau mengganti gambar QRIS yang tampil di layar pembayaran. */
router.post(
  '/qris',
  unggah.single('gambar'),
  tangkap(async (req, res) => {
    if (!req.file) throw new KesalahanAplikasi('Belum ada gambar QRIS yang dipilih.', 400);

    const { rows: lama } = await kueri(
      `select nilai from pengaturan where kunci = 'qris_gambar_path'`
    );

    const hasil = await unggahBerkas({
      buffer: req.file.buffer,
      namaAsli: req.file.originalname,
      mimetype: req.file.mimetype,
      folder: 'qris',
    });

    await simpan('qris_gambar_url', hasil.url, req.user);
    await simpan('qris_gambar_path', hasil.path, req.user);

    if (lama[0]?.nilai) await hapusBerkas(lama[0].nilai).catch(() => {});

    await catatLog({
      user: req.user,
      aksi: 'ubah_pengaturan',
      entitas: 'pengaturan',
      namaEntitas: 'qris_gambar_url',
      detail: { yang_diubah: 'gambar QRIS diganti' },
    });

    res.json({ sukses: true, pesan: 'Gambar QRIS berhasil disimpan.', data: await bacaSemua() });
  })
);

router.delete(
  '/qris',
  tangkap(async (req, res) => {
    const { rows } = await kueri(
      `select nilai from pengaturan where kunci = 'qris_gambar_path'`
    );
    if (rows[0]?.nilai) await hapusBerkas(rows[0].nilai).catch(() => {});
    await simpan('qris_gambar_url', null, req.user);
    await simpan('qris_gambar_path', null, req.user);
    res.json({ sukses: true, pesan: 'Gambar QRIS dihapus.', data: await bacaSemua() });
  })
);

export default router;
