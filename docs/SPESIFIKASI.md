# Spesifikasi Aplikasi Kasir Boomboo

**Versi:** 1.0 — 25 September 2026
**Status:** Menunggu peninjauan Lutfi. **Belum ada kode yang ditulis.**
**Sumber kebutuhan:** `brainstorming.md` (keputusan K1–K23)

---

## Daftar Isi

1. [Tujuan & Batasan](#1-tujuan--batasan)
2. [Susunan Teknologi](#2-susunan-teknologi)
3. [Identitas Visual](#3-identitas-visual)
4. [Model Data](#4-model-data)
5. [Aturan Bisnis](#5-aturan-bisnis)
6. [Daftar Halaman](#6-daftar-halaman)
7. [Alur Utama](#7-alur-utama)
8. [Daftar Endpoint Backend](#8-daftar-endpoint-backend)
9. [Struktur Folder](#9-struktur-folder)
10. [Penempatan di Vercel](#10-penempatan-di-vercel)
11. [Keamanan](#11-keamanan)
12. [Gelombang Pengerjaan](#12-gelombang-pengerjaan)
13. [Yang Sengaja Tidak Dibuat](#13-yang-sengaja-tidak-dibuat)
14. [Yang Masih Ditunggu dari Lutfi](#14-yang-masih-ditunggu-dari-lutfi)

---

## 1. Tujuan & Batasan

Aplikasi kasir berbasis web untuk berjualan di event Boomboo tanggal **7–11 Oktober 2026**. Dipakai oleh **3–7 orang sekaligus**, masing-masing melayani pembeli agar antrian tidak menumpuk.

| Batasan | Isi |
|---|---|
| Tenggat kerja | **3–4 Oktober 2026** (bukan 7 Oktober) — sisanya untuk uji coba dan memasukkan data awal |
| Perangkat | Bermacam-macam: HP, tablet, laptop. **Wajib responsif di ketiganya** |
| Internet | **Online penuh.** Tidak ada mode offline. Cadangan: tethering 2 HP beda operator + nota kertas |
| Pembayaran | **QRIS statis BCA** dan **Tunai**. Tidak ada gerbang pembayaran, tidak ada bayar campur |
| Hak akses | Semua user bisa melakukan semua hal. Kolom `role` disimpan tapi belum membatasi apa pun |
| Struk | **Tidak ada struk cetak.** Struk berupa halaman web, linknya dikirim lewat WhatsApp |

---

## 2. Susunan Teknologi

### Frontend

| Bagian | Pilihan |
|---|---|
| Framework | Vite + React, **JavaScript (bukan TypeScript)** |
| Styling | Tailwind CSS + komponen shadcn |
| State | Zustand (state lokal aplikasi) + TanStack Query (data dari server) |
| Paket lain | axios, react-hot-toast, react-icons, react-router-dom |
| Arsitektur | **Feature Driven Development** |

### Backend

| Bagian | Pilihan |
|---|---|
| Landasan | Node.js + Express.js, **JavaScript (bukan TypeScript)** |
| Pengembangan | nodemon |
| Akses basis data | **`pg`** memakai connection string pooler Supabase |
| Akses penyimpanan berkas | `@supabase/supabase-js` — **khusus untuk Storage saja** |
| Kata sandi | bcrypt |
| Sesi login | JWT |
| Arsitektur | **Feature Driven Development**, sama seperti frontend |

> **Kenapa `pg`, bukan `supabase-js`, untuk basis data?**
> Aplikasi ini menyimpan uang dan stok. Saat satu penjualan terjadi, ada beberapa penulisan yang **harus berhasil semua atau gagal semua** (kurangi stok, tulis buku pergerakan, tulis transaksi, tulis log). `pg` bisa membungkus itu dalam satu transaksi basis data (`BEGIN` … `COMMIT`). Pustaka `supabase-js` lewat REST tidak bisa. Kalau dipaksakan, ada risiko stok berkurang tapi transaksinya gagal tersimpan — dan itu tidak bisa ditelusuri.

### Basis Data & Penyimpanan

| Bagian | Pilihan |
|---|---|
| Basis data | Supabase PostgreSQL |
| Penyimpanan berkas | Supabase Storage, bucket **`files`** |
| Penempatan | Vercel — frontend dan backend **terpisah** |

---

## 3. Identitas Visual

Diambil dari `BO_BrandBook_2024.pdf` (56 halaman, disusun oleh Chiquita Kusumahadi).

### Warna

| Nama | Kode | Peran |
|---|---|---|
| **Boom Red** (layar) | `#e43222` | Warna tanda tangan merek, untuk layar |
| **Boom Red** (cetak) | `#c83c32` | Warna utama |
| **Leaf Green** | `#537236` | Warna utama |
| **Seed Yellow** | `#f3db9f` | Warna utama |
| Biru | `#2e4193` | Warna pendukung |
| **Cokelat tua** | `#3d1f12` | Warna pendukung — **dipakai sebagai warna teks** |
| Terakota | `#cd5731` | Warna pendukung |
| Abu terang | `#d1d1d0` | Netral |
| Putih | `#ffffff` | Netral |

**Aturan dari brand book yang wajib dipatuhi:**

1. **Jangan pakai warna hitam untuk teks, dan jangan sekali-kali hitam sebagai latar.** Pakai cokelat tua `#3d1f12` sebagai gantinya.
2. **Maksimal 3 warna dalam satu desain.** Kombinasinya harus berisi minimal satu warna utama, satu warna pendukung, dan satu netral terang.
3. Logo utama **selalu** dalam warna Boom Red.

### Huruf

| Huruf | Dipakai untuk |
|---|---|
| **Sao Torpes** | Judul, kepala bagian, kalimat pendek yang berkesan. Jangan untuk teks panjang, jangan ditempel langsung di sebelah logo |
| **Nimbus Sans Condensed** | Teks isi. Semi-bold untuk sub-judul, regular untuk teks panjang |

> **Catatan Claude:** kedua huruf ini tidak tersedia gratis di Google Fonts. Brand book menyebut berkasnya ada di satu folder Google Drive. **Lihat bagian 14** — berkas huruf ini masih ditunggu. Sementara belum ada, dipakai pengganti yang bentuknya paling mendekati.

### Berkas logo & ikon

Sudah berhasil ditarik dari brand book, tersimpan di folder **`brand-assets/`** dalam bentuk **SVG** (vektor, tidak pecah saat diperbesar) dan **PNG latar transparan 300 dpi**:

| Berkas | Isi | Aturan pakai |
|---|---|---|
| `logo-utama` | Tulisan BOOMBOO melengkung | **Selalu berwarna Boom Red.** Ini logo yang dipakai di aplikasi dan struk |
| `logo-lengkap` | Logo + pita bertuliskan "TERBUAT DARI BAHAN SEGAR" | Untuk bagian kepala halaman struk |
| `monogram` | Lambang pendukung | **Tidak boleh berdiri sendiri** |
| `ikon-utama` | Cabai rawit, daun jeruk, percikan | Cabai boleh sendiri. Daun jeruk & percikan **hanya** boleh bersama cabai |
| `elemen-dekoratif` | Bingkai belah ketupat & pita | Hiasan halaman struk |

**Larangan logo (dari brand book):** jangan diberi efek bayangan, jangan dibalik, jangan diubah proporsinya, jangan diubah jaraknya, jangan dipakai versi garis luar saja, jangan ada bagian yang dihilangkan.

### Pembagian rasa desain

| Bagian | Tampilan |
|---|---|
| **Aplikasi dalam** (kasir, stok, dashboard, dan lainnya) | Latar **putih**, teks cokelat tua, **Boom Red hanya sebagai aksen** — tombol utama, penanda aktif, angka penting. Bersih dan cepat dibaca, karena staf harus membaca angka sambil terburu-buru |
| **Halaman struk** (dilihat pembeli) | **Tampil penuh identitas merek** — logo lengkap, warna Boom Red & Seed Yellow, ikon cabai, bingkai belah ketupat, watermark. Ini wajah Boomboo ke pelanggan |

Alasannya: brand book sendiri menutup bab desain dengan *"Make sure all text can be clearly read."* Layar kasir yang terlalu ramai memperlambat kerja dan memicu salah baca angka.

---

## 4. Model Data

Semua nilai uang disimpan sebagai **bilangan bulat rupiah** (tanpa koma). Semua waktu memakai `timestamptz`.

### 4.1 `users`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid, kunci utama | |
| `nama` | text | |
| `email` | text, unik | Email kantor, dipakai untuk masuk |
| `password_hash` | text | bcrypt |
| `role` | text | Disimpan, **belum dipakai membatasi apa pun** |
| `dibuat_pada` | timestamptz | |
| `diarsipkan_pada` | timestamptz, boleh kosong | |

### 4.2 `produk`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | |
| `nama` | text | |
| `harga` | integer | Harga normal |
| `harga_diskon` | integer, boleh kosong | |
| `nama_diskon` | text, boleh kosong | Hanya terisi kalau `harga_diskon` terisi |
| `foto_url` | text, boleh kosong | Supabase Storage |
| `stok` | integer, awal 0 | **Angka baca-cepat.** Hanya boleh berubah bersamaan dengan penulisan baris `pergerakan_stok` |
| `diarsipkan_pada` | timestamptz, boleh kosong | Pengganti hapus permanen |
| `dibuat_pada`, `diubah_pada` | timestamptz | |

### 4.3 `menu`

Sama persis dengan `produk`, **tanpa kolom `stok`**.

### 4.4 `pergerakan_stok` — buku besar stok

Inti dari aturan "stok sangat ketat". Setiap perubahan stok jadi satu baris. Tidak ada baris yang boleh diubah atau dihapus.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | |
| `produk_id` | uuid | |
| `jenis` | text | `penambahan`, `pengurangan_manual`, `penjualan`, `pembatalan`, `opname` |
| `jumlah` | integer | **Positif** untuk masuk, **negatif** untuk keluar |
| `stok_sebelum` | integer | |
| `stok_sesudah` | integer | |
| `alasan` | text, boleh kosong | **Wajib** untuk `pengurangan_manual`: rusak, tumpah, hilang, koreksi hitungan |
| `catatan` | text, boleh kosong | |
| `transaksi_id` | uuid, boleh kosong | Terisi untuk `penjualan` dan `pembatalan` |
| `user_id`, `nama_user` | uuid, text | Nama disalin supaya tetap terbaca meski user diarsipkan |
| `dibuat_pada` | timestamptz | |

### 4.5 `transaksi`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | |
| `nomor` | text, unik | Contoh: `BB-20261007-0001` |
| `kode_struk` | text, unik | **Kode acak panjang** untuk link struk publik |
| `status` | text | `menunggu_pembayaran`, `selesai`, `batal` |
| `metode_bayar` | text, boleh kosong | `qris`, `tunai` |
| `subtotal` | integer | Jumlah semua baris barang |
| `diskon_jenis` | text, boleh kosong | `persen` atau `nominal` |
| `diskon_nilai` | integer, boleh kosong | Angka yang diketik kasir |
| `diskon_rupiah` | integer | **Hasil rupiahnya, dibekukan** |
| `total` | integer | Tidak boleh di bawah nol |
| `uang_diterima` | integer, boleh kosong | Khusus tunai |
| `kembalian` | integer, boleh kosong | Khusus tunai |
| `nama_pembeli` | text, boleh kosong | |
| `nomor_wa` | text, boleh kosong | |
| `status_struk` | text | `belum_diisi`, `menunggu_kirim`, `terkirim`, `dilewati` |
| `kasir_id`, `nama_kasir` | uuid, text | |
| `dikonfirmasi_oleh_id`, `nama_pengonfirmasi` | uuid, text | |
| `ditandai_stok_kurang` | boolean | Penanda kasus pada aturan 5.6 |
| `dibuat_pada`, `dikonfirmasi_pada`, `dibatalkan_pada` | timestamptz | |

### 4.6 `transaksi_item`

**Semua kolom di sini dibekukan** — disalin saat transaksi dibuat, tidak pernah menunjuk ke harga yang berlaku sekarang.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | |
| `transaksi_id` | uuid | |
| `jenis_barang` | text | `produk` atau `menu` |
| `barang_id` | uuid | Untuk penelusuran saja |
| `nama_barang` | text | **Dibekukan** |
| `harga_normal` | integer | **Dibekukan** |
| `harga_diskon` | integer, boleh kosong | **Dibekukan** |
| `nama_diskon` | text, boleh kosong | **Dibekukan** |
| `harga_dipakai` | integer | Harga yang benar-benar ditagihkan |
| `jumlah` | integer | |
| `subtotal` | integer | `harga_dipakai × jumlah` |

### 4.7 `log_aktivitas`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | |
| `user_id`, `nama_user` | uuid, text | Nama disalin |
| `aksi` | text | `tambah_produk`, `ubah_produk`, `arsip_produk`, `tambah_menu`, `ubah_menu`, `arsip_menu`, `ubah_diskon`, `tambah_stok`, `kurang_stok`, `opname`, `beri_diskon_transaksi`, `konfirmasi_pembayaran`, `batal_transaksi`, `tambah_user`, `unggah_media`, `ubah_pengaturan` |
| `entitas` | text | `produk`, `menu`, `stok`, `transaksi`, `user`, `media`, `pengaturan` |
| `entitas_id`, `nama_entitas` | uuid, text | |
| `detail` | jsonb | Nilai sebelum dan sesudah |
| `dibuat_pada` | timestamptz | |

### 4.8 `kontak_whatsapp`

Daftar nomor yang pernah dihubungi — aset pemasaran Boomboo (K8).

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | |
| `nomor` | text, unik | Disimpan dalam bentuk baku `62xxxxxxxxxx` |
| `nama` | text, boleh kosong | Nama terakhir yang diberikan |
| `pertama_pada`, `terakhir_pada` | timestamptz | |
| `jumlah_transaksi` | integer | |
| `total_belanja` | integer | |

### 4.9 `media`

Berdiri sendiri — **tidak menempel ke transaksi mana pun** (keputusan K20).

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | |
| `nama_berkas` | text | |
| `url` | text | Supabase Storage, bucket `files` |
| `ukuran_byte` | integer | |
| `catatan` | text, boleh kosong | Diisi manual kalau mau |
| `diunggah_oleh_id`, `nama_pengunggah` | uuid, text | |
| `diunggah_pada` | timestamptz | Otomatis, jadi masih bisa dicocokkan kasar per hari |

### 4.10 `pengaturan`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `kunci` | text, kunci utama | `qris_gambar_url`, `nama_toko`, `teks_struk_bawah`, `kode_pendaftaran` |
| `nilai` | text | |
| `diubah_oleh_id`, `nama_pengubah` | uuid, text | |
| `diubah_pada` | timestamptz | |

---

## 5. Aturan Bisnis

Bagian ini adalah jantung aplikasinya. Semua aturan di sini **dijalankan di backend**, tidak pernah dititipkan ke browser.

### 5.1 Stok hanya bergerak lewat buku besar

`produk.stok` **tidak pernah** diubah sendirian. Setiap perubahan harus terjadi dalam satu transaksi basis data yang juga menulis satu baris `pergerakan_stok`. Kalau salah satu gagal, dua-duanya dibatalkan.

Tersedia satu pemeriksaan silang: `SUM(pergerakan_stok.jumlah)` per produk **harus sama dengan** `produk.stok`. Kalau beda, berarti ada yang salah dan harus diperiksa.

### 5.2 Stok tidak boleh minus

Ditolak di tiga titik:

1. Saat barang dimasukkan ke keranjang
2. Saat kasir menekan submit ke halaman pembayaran
3. Saat pembayaran dikonfirmasi

Pengecualian hanya satu: aturan 5.6.

### 5.3 Pengurangan stok manual wajib beralasan

Pilihan alasan: **rusak**, **tumpah**, **hilang**, **koreksi hitungan**. Tercatat di buku besar dan di log aktivitas beserta nama pelakunya.

### 5.4 Harga dibekukan

Saat transaksi dibuat, semua harga **disalin** ke `transaksi_item`. Mengubah harga produk besok **tidak** mengubah struk dan laporan kemarin.

Yang dibekukan: nama barang, harga normal, harga diskon, nama diskon, harga yang dipakai, dan diskon total dari kasir (dalam bentuk rupiah, bukan persen).

> Ini **tidak** mengubah tampilan. Layar kasir dan halaman produk tetap menampilkan harga dan stok yang berlaku sekarang.

### 5.5 Harga diskon dipakai otomatis

Kalau `harga_diskon` terisi, itulah yang ditagihkan. Kasir tidak memilih dan tidak bisa mengubahnya.

### 5.6 Kalau stok habis saat uang sudah masuk

Dengan 3–7 kasir bersamaan, dua kasir bisa berada di halaman pembayaran untuk botol terakhir, dan keduanya sudah menerima uang.

**Menolak transaksi yang uangnya sudah masuk adalah pilihan terburuk.** Maka:

1. Transaksi **tetap diloloskan**
2. Kolom `ditandai_stok_kurang` diisi `true`
3. Peringatan muncul di layar kasir
4. Buku besar tetap mencatat pergerakannya apa adanya, sehingga selisihnya jujur dan ketahuan saat stok opname

### 5.7 Diskon dari kasir

- Pilih **salah satu**: persentase **atau** potongan nominal. Tidak boleh dua-duanya.
- Tidak ada batas maksimal (Lutfi percaya pada timnya).
- Total setelah diskon **tidak boleh di bawah nol**.
- **Wajib tercatat di log**: siapa memberi diskon berapa, di transaksi nomor berapa.

### 5.8 Perjalanan status transaksi

```
                    ┌──────────────────────┐
  kasir submit ───► │ menunggu_pembayaran  │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
    admin konfirmasi bayar                 admin batalkan
             │                                   │
             ▼                                   ▼
      ┌────────────┐                      ┌────────────┐
      │  selesai   │                      │   batal    │
      └────────────┘                      └────────────┘
   stok berkurang                      stok TIDAK berkurang
   riwayat masuk                       tetap tercatat sebagai batal
```

Transaksi yang sudah `selesai` masih bisa dibatalkan belakangan. Saat itu terjadi, stok **dikembalikan lewat baris pergerakan baru** berjenis `pembatalan` — bukan dengan menghapus baris lama.

### 5.9 Hapus berarti arsip

Tombol hapus pada produk, menu, dan user hanya mengisi `diarsipkan_pada`. Barangnya hilang dari layar kasir, tapi laporan dan log lama tetap utuh.

### 5.10 Nomor WhatsApp

- Disimpan dalam bentuk baku `62xxxxxxxxxx` (awalan `0` dan `+62` diseragamkan otomatis).
- Kalau nomornya sudah pernah ada, barisnya diperbarui — bukan dibuat ganda.
- Nama boleh kosong; kalau kosong, pesan memakai sapaan cadangan **"Halo Kak,"**.
- Di layar input nomor ada kalimat: *"Nomor Anda kami simpan untuk mengirim struk dan informasi promo Boomboo."*

---

## 6. Daftar Halaman

| # | Halaman | Perlu login? | Gelombang |
|---|---|---|---|
| 1 | Masuk | Tidak | 1 |
| 2 | Daftar akun baru | Tidak | 1 |
| 3 | **Kasir** — keranjang & pemilihan barang | Ya | 1 |
| 4 | Pembayaran — QRIS | Ya | 1 |
| 5 | Pembayaran — Tunai | Ya | 1 |
| 6 | Produk — daftar, tambah, ubah, arsip | Ya | 1 |
| 7 | Menu — daftar, tambah, ubah, arsip | Ya | 1 |
| 8 | Stok — tambah, kurang, kartu stok per produk | Ya | 1 |
| 9 | Dashboard | Ya | 1 |
| 10 | Pengaturan — gambar QRIS dan lainnya | Ya | 1 |
| 11 | Isi nama & nomor WhatsApp pembeli | Ya | 2 |
| 12 | **Struk publik** | **Tidak** | 2 |
| 13 | Antrian kirim struk | Ya | 2 |
| 14 | Log aktivitas | Ya | 2 |
| 15 | Kelola user | Ya | 1 |
| 16 | Media | Ya | 3 |
| 17 | Stok opname | Ya | 3 |

---

## 7. Alur Utama

### 7.1 Penjualan lewat QRIS

1. Kasir memilih barang. Layar berisi tombol besar bergambar foto produk/menu, harga, dan sisa stok.
2. Kasir mengatur jumlah, boleh memberi diskon total.
3. Kasir menekan **Lanjut ke Pembayaran** → transaksi dibuat berstatus `menunggu_pembayaran`. **Stok belum berkurang.**
4. Layar pembayaran QRIS menampilkan **gambar QRIS** dan **total yang harus dibayar dengan angka besar** — supaya admin gampang mencocokkan dengan nominal di bukti bayar pembeli, karena QRIS statis tidak mengunci nominal.
5. Pembeli memindai, mengetik nominal, dan membayar *(di luar sistem)*.
6. Pembeli menunjukkan bukti, admin memotretnya *(di luar sistem)*.
7. Admin menekan **Konfirmasi Pembayaran** → status jadi `selesai`, stok berkurang, buku besar & log terisi.
8. Layar berpindah ke pengisian nama & nomor WhatsApp, dengan tombol **Lewati**.

### 7.2 Penjualan tunai

Sama sampai langkah 3. Lalu: layar tunai menampilkan total, kasir mengetik uang yang diterima, sistem menghitung kembalian, kasir menekan konfirmasi.

### 7.3 Kirim struk

1. Kasir mengisi nama (boleh kosong) + nomor WhatsApp → status struk jadi `menunggu_kirim`. Kasir langsung lanjut melayani pembeli berikutnya.
2. Di halaman **Antrian Kirim Struk**, petugas melihat daftar struk yang belum terkirim.
3. Petugas menekan tombol kirim → aplikasi WhatsApp terbuka dengan teks **sudah terisi lengkap** → petugas tinggal menekan kirim.
4. Petugas menekan **Tandai Terkirim** di aplikasi → status jadi `terkirim`.

Halaman antrian sebaiknya dibuka di **satu HP dengan nomor WhatsApp resmi Boomboo**, supaya semua pesan keluar dari satu nomor.

**Isi pesannya:**

```
Halo [nama, atau "Kak"]!
Terima kasih sudah belanja di Boomboo.

Total belanja: Rp [total]
Struk: [link]

Gurih, nagih. Sampai ketemu lagi!
```

### 7.4 Halaman struk publik

Dibuka tanpa login lewat link berkode acak. Isinya:

- Logo lengkap Boomboo
- Nomor transaksi, tanggal & jam lengkap
- Daftar barang: nama, jumlah, harga satuan, subtotal
- Diskon (kalau ada), beserta namanya
- **Total besar dan jelas**
- Metode bayar; untuk tunai ditambah uang diterima & kembalian
- Nama kasir
- Ucapan terima kasih, hiasan ikon cabai & bingkai belah ketupat, dan watermark Boomboo
- Tombol **Simpan sebagai gambar**

Tampilan wajib rapi di layar HP sempit sampai layar laptop.

---

## 8. Daftar Endpoint Backend

Semua jalur diawali `/api`. Semua kecuali yang ditandai **publik** memerlukan JWT.

| Kelompok | Metode & Jalur | Kegunaan |
|---|---|---|
| **auth** | `POST /auth/daftar` | Membuat akun baru |
| | `POST /auth/masuk` | Masuk, mengembalikan JWT |
| | `GET /auth/saya` | Data user yang sedang masuk |
| **produk** | `GET /produk` | Daftar produk (bisa disaring, tanpa yang diarsipkan) |
| | `POST /produk` | Tambah produk, stok mulai 0 |
| | `PATCH /produk/:id` | Ubah produk |
| | `DELETE /produk/:id` | Arsipkan |
| | `POST /produk/:id/foto` | Unggah foto |
| **menu** | Sama seperti produk, tanpa urusan stok | |
| **stok** | `POST /stok/:produkId/tambah` | Menambah stok |
| | `POST /stok/:produkId/kurang` | Mengurangi stok, **alasan wajib** |
| | `GET /stok/:produkId/kartu` | Kartu stok — seluruh riwayat pergerakan |
| | `POST /stok/opname` | Memasukkan hasil hitung fisik |
| **transaksi** | `POST /transaksi` | Membuat transaksi `menunggu_pembayaran` |
| | `POST /transaksi/:id/konfirmasi` | Konfirmasi pembayaran → `selesai` |
| | `POST /transaksi/:id/batal` | Membatalkan |
| | `PATCH /transaksi/:id/pembeli` | Mengisi nama & nomor WhatsApp |
| | `GET /transaksi` | Daftar transaksi, bisa disaring |
| **struk** | `GET /struk/publik/:kode` | **Publik.** Data struk untuk halaman umum. Sengaja memakai awalan `publik` supaya tidak bentrok dengan jalur `antrian` di bawahnya |
| | `GET /struk/antrian` | Daftar struk yang belum terkirim |
| | `POST /struk/:id/tandai-terkirim` | Menandai sudah dikirim |
| **dashboard** | `GET /dashboard/ringkasan` | Uang masuk QRIS vs tunai, disaring tanggal |
| | `GET /dashboard/harian` | Perbandingan penjualan hari per hari |
| **media** | `GET /media` · `POST /media` · `DELETE /media/:id` | Kelola berkas bukti bayar |
| **log** | `GET /log` | Log aktivitas, bisa disaring |
| **user** | `GET /user` · `POST /user` · `PATCH /user/:id` · `DELETE /user/:id` | Kelola user |
| **pengaturan** | `GET /pengaturan` · `PUT /pengaturan/:kunci` | Termasuk mengganti gambar QRIS |

---

## 9. Struktur Folder

### Frontend (`pos-boomboo-web`)

```
src/
  app/
    router.jsx
    providers.jsx
    layouts/
  features/
    auth/          api/  components/  hooks/  pages/  store/
    kasir/         api/  components/  hooks/  pages/  store/
    produk/
    menu/
    stok/
    transaksi/
    struk/
    dashboard/
    media/
    log/
    user/
    pengaturan/
  shared/
    components/ui/       (komponen shadcn)
    components/          (komponen pakai-ulang milik sendiri)
    lib/                 (axios, format rupiah, format tanggal)
    hooks/
    constants/
  assets/brand/          (logo & ikon dari brand-assets/)
  styles/
```

Setiap folder fitur berdiri sendiri: punya pemanggilan API, komponen, hook, halaman, dan state-nya masing-masing. Fitur **tidak boleh** memanggil isi dalam fitur lain — kalau ada yang dipakai bersama, naikkan ke `shared/`.

### Backend (`pos-boomboo-api`)

```
src/
  features/
    auth/          auth.routes.js  auth.controller.js  auth.service.js  auth.validation.js
    produk/
    menu/
    stok/
    transaksi/
    struk/
    dashboard/
    media/
    log/
    user/
    pengaturan/
  shared/
    db/            pool.js  transaksi.js   (pembungkus BEGIN/COMMIT)
    storage/       supabase.js
    middleware/    auth.js  error.js  validate.js
    utils/         rupiah.js  kode-acak.js  nomor-wa.js
  app.js
  server.js
api/
  index.js         (pintu masuk untuk Vercel)
migrations/
  001_skema_awal.sql
  002_data_awal.sql
```

**Pembagian tugas tiap berkas:**

| Berkas | Isinya |
|---|---|
| `*.routes.js` | Pemetaan jalur ke controller. Tidak ada logika |
| `*.controller.js` | Membaca permintaan, memanggil service, menyusun balasan. Tidak ada aturan bisnis |
| `*.service.js` | **Seluruh aturan bisnis dan akses basis data** |
| `*.validation.js` | Pemeriksaan bentuk data yang masuk |

---

## 10. Penempatan di Vercel

Frontend dan backend **dua project Vercel terpisah**.

### Frontend

`vercel.json`:
- Perintah bangun: `vite build`, keluaran `dist`
- Semua jalur diarahkan ke `index.html` supaya react-router jalan saat halaman disegarkan
- Variabel lingkungan: `VITE_API_URL`

### Backend

Express dijalankan sebagai fungsi tanpa server. `api/index.js` mengekspor aplikasi Express, `vercel.json` mengarahkan semua jalur ke sana.

**Yang harus diperhatikan karena tanpa server:**

1. **Jangan menyimpan berkas di cakram lokal.** Semua unggahan langsung ke Supabase Storage.
2. **Jangan menyimpan apa pun di memori antar permintaan.** Tidak ada penyimpanan sesi di memori — karena itu JWT, bukan session.
3. **Sambungan basis data lewat pooler.** Memakai alamat pooler Supabase di porta `6543`, dengan kolam sambungan berukuran kecil, supaya tidak menghabiskan jatah sambungan saat banyak fungsi hidup bersamaan.

Variabel lingkungan backend: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`, `JWT_SECRET`, `CORS_ORIGIN`.

---

## 11. Keamanan

| Hal | Cara |
|---|---|
| Kata sandi | Disimpan sebagai hash bcrypt, tidak pernah disimpan apa adanya |
| Sesi | JWT, disimpan di penyimpanan peramban, dikirim di kepala `Authorization` |
| Kunci Supabase | **Service role key hanya di backend.** Tidak pernah dikirim ke peramban |
| Link struk | Kode acak panjang, tidak bisa ditebak dengan menaikkan angka |
| Aturan bisnis | Semuanya diperiksa ulang di backend. Peramban tidak dipercaya |
| Kolom kata sandi | Ada tombol lihat/sembunyi |
| Berkas rahasia | `supabase untuk pos.txt` dan semua `.env*` **wajib masuk `.gitignore` sebelum push pertama** |

### Catatan tentang halaman daftar akun

Lutfi memutuskan halaman pendaftaran **tetap ada dan terbuka** (J3).

Penjaga sederhana yang bisa ditambahkan tanpa mengubah keputusan itu: pendaftaran meminta satu **kode pendaftaran** yang disimpan di halaman Pengaturan dan dibagikan ke tim. Orang luar yang menemukan alamat aplikasinya tidak bisa membuat akun. Biayanya satu kolom isian.

**Status:** menunggu keputusan Lutfi. Kalau tidak dipakai, pendaftaran dibiarkan terbuka sesuai permintaan.

---

## 12. Gelombang Pengerjaan

### Gelombang 1 — wajib siap 3–4 Oktober

1. Kerangka project, sambungan basis data, migrasi tabel
2. Masuk, daftar, kelola user dasar
3. Produk & Menu: daftar, tambah, ubah, arsip, unggah foto, log
4. Stok: tambah, kurang beralasan, buku besar, kartu stok
5. Kasir: keranjang, diskon total, alur QRIS, alur tunai, konfirmasi, pembatalan
6. Pengaturan: unggah & ganti gambar QRIS
7. Dashboard dasar: uang masuk QRIS vs tunai per hari

### Gelombang 2 — sebelum 7 Oktober

8. Isi nama & nomor WhatsApp
9. Halaman struk publik yang indah + watermark
10. Antrian kirim struk
11. Halaman log aktivitas
12. Daftar kontak WhatsApp

### Gelombang 3 — boleh menyusul saat event

13. Media (unggah bukti bayar)
14. Stok opname
15. Dashboard: penyaring tanggal + perbandingan harian

---

## 13. Yang Sengaja Tidak Dibuat

Supaya jelas dan tidak ada salah paham:

| Tidak dibuat | Alasan |
|---|---|
| Mode offline | Terlalu rumit untuk sisa waktu. Cadangannya tethering + nota kertas |
| Gerbang pembayaran otomatis | Belum ada. QRIS statis, konfirmasi manual |
| Pembatasan hak akses per role | Keputusan K19. Kolom `role` sudah disiapkan supaya tinggal diaktifkan |
| Buka/tutup kasir per shift | Keputusan K17 |
| Struk cetak / printer | Keputusan K16 |
| Bayar campur | Keputusan K4 |
| Bahan baku Menu ikut dihitung | Keputusan K1 |
| Banyak cabang, member, poin, integrasi marketplace | Di luar kebutuhan event |

---

## 14. Yang Masih Ditunggu dari Lutfi

| No | Hal | Dibutuhkan untuk | Mendesak? |
|---|---|---|---|
| 1 | **Gambar QRIS BCA** | Layar pembayaran | Sebelum uji coba. Sementara bisa dipakai gambar contoh |
| 2 | **Kira-kira ada berapa Produk + Menu** | Bentuk layar kasir: kalau di atas 30, perlu kotak pencarian | Sebelum layar kasir dikerjakan |
| 3 | **Berkas huruf Sao Torpes & Nimbus Sans Condensed** dari folder Google Drive merek | Supaya huruf di struk persis sesuai merek | Sebelum Gelombang 2. Sementara dipakai pengganti terdekat |
| 4 | **Keputusan kode pendaftaran** (bagian 11) | Halaman daftar akun | Sebelum aplikasi dipasang di alamat umum |
| 5 | Foto produk & menu | Layar kasir | Bisa menyusul, kolomnya sudah disiapkan |

---

## Riwayat Dokumen

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 25 September 2026 | Versi pertama, disusun dari `brainstorming.md` keputusan K1–K23 dan `BO_BrandBook_2024.pdf` |
