import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './features/auth/auth.routes.js';
import userRoutes from './features/user/user.routes.js';
import produkRoutes from './features/produk/produk.routes.js';
import menuRoutes from './features/menu/menu.routes.js';
import stokRoutes from './features/stok/stok.routes.js';
import transaksiRoutes from './features/transaksi/transaksi.routes.js';
import strukRoutes from './features/struk/struk.routes.js';
import dashboardRoutes from './features/dashboard/dashboard.routes.js';
import mediaRoutes from './features/media/media.routes.js';
import logRoutes from './features/log/log.routes.js';
import pengaturanRoutes from './features/pengaturan/pengaturan.routes.js';

import { penanganKesalahan } from './shared/middleware/error.js';

const app = express();

const asalBoleh = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(asal, lanjut) {
      // Permintaan tanpa asal (misalnya dari alat uji) tetap diizinkan
      if (!asal) return lanjut(null, true);
      if (asalBoleh.length === 0 || asalBoleh.includes(asal)) return lanjut(null, true);
      // Semua alamat pratinjau Vercel juga diizinkan
      if (/\.vercel\.app$/.test(new URL(asal).hostname)) return lanjut(null, true);
      return lanjut(new Error('Asal permintaan tidak diizinkan.'));
    },
    credentials: false,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/sehat', (_req, res) =>
  res.json({ sukses: true, pesan: 'Backend Boomboo berjalan.', waktu: new Date().toISOString() })
);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/produk', produkRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/stok', stokRoutes);
app.use('/api/transaksi', transaksiRoutes);
app.use('/api/struk', strukRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/log', logRoutes);
app.use('/api/pengaturan', pengaturanRoutes);

app.use((req, res) =>
  res.status(404).json({ sukses: false, pesan: `Alamat ${req.originalUrl} tidak dikenal.` })
);

app.use(penanganKesalahan);

export default app;
