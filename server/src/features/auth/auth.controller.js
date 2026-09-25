import * as service from './auth.service.js';

export const daftar = async (req, res) => {
  const hasil = await service.daftar(req.body);
  res.status(201).json({ sukses: true, pesan: 'Akun berhasil dibuat.', data: hasil });
};

export const masuk = async (req, res) => {
  const hasil = await service.masuk(req.body);
  res.json({ sukses: true, pesan: `Selamat datang, ${hasil.user.nama}!`, data: hasil });
};

export const saya = async (req, res) => {
  const user = await service.saya(req.user.id);
  res.json({ sukses: true, data: user });
};

export const gantiPassword = async (req, res) => {
  await service.gantiPassword(req.user.id, req.body);
  res.json({ sukses: true, pesan: 'Kata sandi berhasil diganti.' });
};
