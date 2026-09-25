import bcrypt from 'bcryptjs';
import { kueri } from '../../shared/db/pool.js';
import { KesalahanAplikasi } from '../../shared/middleware/error.js';
import { buatToken } from '../../shared/middleware/auth.js';
import { catatLog } from '../../shared/utils/log.js';

const rapikan = (u) => ({
  id: u.id,
  nama: u.nama,
  email: u.email,
  role: u.role,
  dibuat_pada: u.dibuat_pada,
});

export async function daftar({ nama, email, password, kode_pendaftaran }) {
  // Kalau pengelola mengisi kode pendaftaran di halaman Pengaturan, kode itu
  // jadi wajib. Kalau dibiarkan kosong, pendaftaran terbuka untuk siapa saja.
  const { rows: atur } = await kueri(
    `select nilai from pengaturan where kunci = 'kode_pendaftaran'`
  );
  const kodeWajib = atur[0]?.nilai?.trim();
  if (kodeWajib && String(kode_pendaftaran || '').trim() !== kodeWajib) {
    throw new KesalahanAplikasi('Kode pendaftaran salah.', 403);
  }

  const emailBaku = email.trim().toLowerCase();
  const { rows: sudahAda } = await kueri('select id from users where email = $1', [emailBaku]);
  if (sudahAda.length) throw new KesalahanAplikasi('Email ini sudah terdaftar.', 409);

  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await kueri(
    `insert into users (nama, email, password_hash, role)
     values ($1, $2, $3, 'kasir')
     returning *`,
    [nama.trim(), emailBaku, password_hash]
  );

  const user = rows[0];
  await catatLog({
    user,
    aksi: 'tambah_user',
    entitas: 'user',
    entitasId: user.id,
    namaEntitas: user.nama,
    detail: { cara: 'mendaftar sendiri' },
  });

  return { user: rapikan(user), token: buatToken(user) };
}

export async function masuk({ email, password }) {
  const { rows } = await kueri('select * from users where email = $1', [
    email.trim().toLowerCase(),
  ]);
  const user = rows[0];

  // Pesannya sengaja dibuat sama untuk email salah maupun kata sandi salah,
  // supaya orang luar tidak bisa menebak email mana yang terdaftar.
  const salah = () => new KesalahanAplikasi('Email atau kata sandi salah.', 401);

  if (!user) throw salah();
  if (user.diarsipkan_pada)
    throw new KesalahanAplikasi('Akun ini sudah tidak aktif.', 403);

  const cocok = await bcrypt.compare(password, user.password_hash);
  if (!cocok) throw salah();

  return { user: rapikan(user), token: buatToken(user) };
}

export async function saya(userId) {
  const { rows } = await kueri(
    'select id, nama, email, role, dibuat_pada from users where id = $1',
    [userId]
  );
  return rows[0] || null;
}

export async function gantiPassword(userId, { password_lama, password_baru }) {
  const { rows } = await kueri('select * from users where id = $1', [userId]);
  const user = rows[0];
  if (!user) throw new KesalahanAplikasi('Akun tidak ditemukan.', 404);

  const cocok = await bcrypt.compare(password_lama, user.password_hash);
  if (!cocok) throw new KesalahanAplikasi('Kata sandi lama salah.', 400);

  const hash = await bcrypt.hash(password_baru, 10);
  await kueri('update users set password_hash = $1 where id = $2', [hash, userId]);

  await catatLog({
    user,
    aksi: 'ubah_user',
    entitas: 'user',
    entitasId: user.id,
    namaEntitas: user.nama,
    detail: { yang_diubah: 'kata sandi' },
  });
  return true;
}
