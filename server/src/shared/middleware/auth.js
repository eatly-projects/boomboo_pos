import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { belumMasuk } from './error.js';
import { kueri } from '../db/pool.js';

export function buatToken(user) {
  return jwt.sign(
    { sub: user.id, nama: user.nama, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Memastikan permintaan membawa token yang sah.
 *
 * Catatan: untuk sekarang SEMUA user boleh melakukan semua hal
 * (keputusan K19). Kolom `role` tetap dibaca dan ditempel ke req.user
 * supaya nanti tinggal dipakai kalau pembatasan mau diaktifkan.
 */
export async function wajibMasuk(req, _res, next) {
  try {
    const kepala = req.headers.authorization || '';
    const token = kepala.startsWith('Bearer ') ? kepala.slice(7) : null;
    if (!token) throw belumMasuk();

    let isi;
    try {
      isi = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw belumMasuk('Sesi Anda sudah berakhir. Silakan masuk lagi.');
    }

    const { rows } = await kueri(
      'select id, nama, email, role, diarsipkan_pada from users where id = $1',
      [isi.sub]
    );
    const user = rows[0];
    if (!user) throw belumMasuk('Akun Anda tidak ditemukan.');
    if (user.diarsipkan_pada) throw belumMasuk('Akun Anda sudah tidak aktif.');

    req.user = { id: user.id, nama: user.nama, email: user.email, role: user.role };
    next();
  } catch (e) {
    next(e);
  }
}
