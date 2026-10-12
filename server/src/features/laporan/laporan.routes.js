import { Router } from 'express';
import * as service from './laporan.service.js';
import { buatExcel, namaBerkas } from './laporan.excel.js';
import { wajibMasuk } from '../../shared/middleware/auth.js';
import { tangkap } from '../../shared/middleware/error.js';
import { KesalahanAplikasi } from '../../shared/middleware/error.js';

const router = Router();
router.use(wajibMasuk);

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Tanggalnya wajib dan harus lengkap. Laporan tanpa batas tanggal akan menarik
 * seluruh riwayat sekaligus, dan itu bukan yang dimaksud "laporan harian".
 */
function periksaTanggal(query) {
  const dari = query.tanggal_dari;
  const sampai = query.tanggal_sampai || dari;

  if (!dari || !POLA_TANGGAL.test(dari))
    throw new KesalahanAplikasi('Tanggal laporan belum dipilih.', 400);
  if (!POLA_TANGGAL.test(sampai))
    throw new KesalahanAplikasi('Tanggal akhirnya tidak sah.', 400);
  if (sampai < dari)
    throw new KesalahanAplikasi('Tanggal akhir tidak boleh lebih awal dari tanggal mulai.', 400);

  return { tanggal_dari: dari, tanggal_sampai: sampai };
}

router.get(
  '/',
  tangkap(async (req, res) => {
    const rentang = periksaTanggal(req.query);
    res.json({ sukses: true, data: await service.harian(rentang) });
  })
);

router.get(
  '/excel',
  tangkap(async (req, res) => {
    const rentang = periksaTanggal(req.query);
    const data = await service.harian(rentang);
    const berkas = await buatExcel(data);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${namaBerkas(data)}"`);
    res.send(Buffer.from(berkas));
  })
);

export default router;
