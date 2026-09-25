# Aplikasi Kasir Boomboo

Aplikasi kasir berbasis web untuk berjualan di event Boomboo, 7–11 Oktober 2026.

| Dokumen | Isinya |
|---|---|
| `brainstorming.md` | Catatan seluruh diskusi dan keputusan (K1–K27) |
| `docs/SPESIFIKASI.md` | Spesifikasi teknis lengkap |
| `docs/PROGRESS.md` | Apa yang sudah jadi dan apa yang belum |

---

## Cara menjalankan di komputer sendiri

Butuh **Node.js 20 atau lebih baru**.

### 1. Backend

```
cd server
npm install
npm run dev
```

Berjalan di `http://localhost:4100`. Cek dengan membuka `http://localhost:4100/api/sehat`.

### 2. Frontend

Buka jendela terminal **kedua**:

```
cd web
npm install
npm run dev
```

Buka `http://localhost:5180` di peramban.

### 3. Masuk

| Nama | Email | Peran |
|---|---|---|
| Lutfi Hakim | `lutfi@boomboo.id` | Pemilik |
| Sari Wulandari | `sari@boomboo.id` | Manajer |
| Bagus Prakoso | `bagus@boomboo.id` | Kasir |

Kata sandi ketiganya: `boomboo123`

> Ketiga akun ini **hanya untuk pengembangan dan uji coba**. Ganti kata sandinya
> sebelum aplikasi dipakai berjualan sungguhan.

---

## Perintah lain

### Backend (`cd server`)

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Menjalankan backend dengan muat ulang otomatis |
| `npm run migrate` | Membuat seluruh tabel di basis data |
| `npm run siapkan:bucket` | Menyiapkan tempat penyimpanan berkas di Supabase |
| `npm run seed` | Mengisi user dan data contoh |
| `npm run seed:bersihkan` | Mengosongkan seluruh data contoh |
| `npm run uji` | Menguji alur kasir dari awal sampai akhir |

### Frontend (`cd web`)

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Menjalankan frontend di porta 5180 |
| `npm run build` | Membangun berkas siap pasang ke folder `dist` |

---

## Menyiapkan dari basis data kosong

```
cd server
npm run migrate
npm run siapkan:bucket
npm run seed
```

---

## Susunan folder

```
pos_boomboo/
├─ server/                 Backend: Node.js + Express (JavaScript)
│  ├─ src/features/        Satu folder per fitur
│  ├─ src/shared/          Bagian yang dipakai bersama
│  ├─ migrations/          Berkas SQL pembuat tabel
│  ├─ seed/                Pengisi data contoh
│  ├─ uji/                 Uji alur kasir
│  └─ api/index.js         Pintu masuk untuk Vercel
│
├─ web/                    Frontend: Vite + React (JavaScript)
│  ├─ src/features/        Satu folder per fitur
│  ├─ src/shared/          Komponen dan alat bantu bersama
│  ├─ src/app/             Rute dan kerangka halaman
│  └─ public/merek/        Logo dan ikon dari brand book
│
├─ brand-assets/           Logo hasil ekstraksi dari brand book (hitam)
└─ docs/                   Spesifikasi dan catatan kemajuan
```

---

## Peringatan keamanan

Berkas `supabase untuk pos.txt` di folder utama berisi **kunci penuh ke basis
data**. Berkas itu sudah masuk `.gitignore`, begitu juga seluruh berkas `.env`.
**Jangan pernah meng-commit atau membagikannya.**
