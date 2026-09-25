# Catatan Kemajuan — Aplikasi Kasir Boomboo

**Terakhir diperbarui:** 25 September 2026

---

## Ringkasan

Seluruh **Gelombang 1, 2, dan 3** sudah dikerjakan. Aplikasi bisa dipakai
berjualan dari awal sampai struk terkirim.

| | Jumlah |
|---|---|
| Tabel basis data | 11 |
| Fitur backend | 11 |
| Halaman frontend | 17 |
| Uji alur kasir otomatis | 27 pemeriksaan, semuanya lulus |

---

## Sudah selesai

### Gelombang 1 — inti berjualan

| Bagian | Keadaan | Catatan |
|---|---|---|
| Basis data & migrasi | Selesai | 11 tabel + pemeriksaan silang stok |
| Masuk, daftar, kelola user | Selesai | bcrypt + JWT, kata sandi punya tombol lihat |
| Produk (tambah, ubah, arsip, foto) | Selesai | Stok selalu mulai 0, sesuai keputusan |
| Menu makan | Selesai | Tanpa stok, tidak memotong stok produk apa pun |
| Stok: tambah, kurang, buku pergerakan | Selesai | Pengurangan wajib beralasan |
| Kartu stok per produk | Selesai | Seluruh riwayat keluar-masuk |
| Kasir: keranjang, diskon, QRIS, tunai | Selesai | Termasuk hitung kembalian |
| Konfirmasi & pembatalan pembayaran | Selesai | Pembatalan mengembalikan stok lewat baris baru |
| Pengaturan gambar QRIS | Selesai | Bisa diunggah dan diganti kapan saja |
| Dashboard uang masuk | Selesai | QRIS vs tunai, per hari, per kasir, terlaris |

### Gelombang 2 — strategi struk WhatsApp

| Bagian | Keadaan | Catatan |
|---|---|---|
| Isi nama & nomor WhatsApp | Selesai | Nama opsional, nomor boleh dilewati |
| Halaman struk publik | Selesai | Logo lengkap, warna merek, ikon cabai, watermark |
| Antrian kirim struk | Selesai | Pesan sudah terisi, tinggal tekan kirim |
| Daftar kontak WhatsApp | Selesai | Nomor tidak pernah ganda |
| Log aktivitas + penyaring | Selesai | Bisa disaring per aksi, bagian, orang, tanggal |

### Gelombang 3 — pendukung

| Bagian | Keadaan | Catatan |
|---|---|---|
| Media bukti bayar | Selesai | Berdiri sendiri, tapi mencatat waktu & pengunggah |
| Stok opname | Selesai | Yang tidak diisi dilewati, yang pas tidak dicatat |
| Penyaring tanggal & perbandingan harian | Selesai | Ada di Dashboard dan Transaksi |

---

## Sudah diperiksa

### Uji alur kasir otomatis — `npm run uji`

27 pemeriksaan, semuanya lulus:

- Transaksi dibuat, subtotal dan diskon persentase dihitung benar
- **Stok tidak berkurang** sebelum pembayaran dikonfirmasi
- Stok berkurang tepat setelah konfirmasi, dan tercatat di buku pergerakan
- Kembalian tunai dihitung benar
- Nomor WhatsApp `08...` otomatis dibakukan jadi `62...`
- Struk publik bisa dibuka tanpa masuk, dan tidak membocorkan id transaksi
- **Harga dibekukan**: mengubah harga produk tidak mengubah struk lama
- Membeli melebihi stok ditolak
- Mengurangi stok tanpa alasan ditolak
- Pembatalan mengembalikan stok lewat **baris baru**, riwayat lama tetap utuh
- Diskon, konfirmasi, dan pembatalan semuanya masuk log beserta nama pelakunya
- Jumlah buku pergerakan **cocok** dengan angka stok di seluruh 12 produk

### Diperiksa langsung di peramban

Halaman Masuk, Kasir, Stok, Dashboard, Antrian Kirim Struk, dan Struk Publik
sudah dibuka dan tampil benar dengan data sungguhan di layar lebar.

---

## Data contoh yang sudah ada di basis data

| | Jumlah |
|---|---|
| User | 3 |
| Produk | 12 |
| Menu | 9 |
| Transaksi | 168 (162 selesai, 6 batal), tersebar di 7 hari |
| Baris barang terjual | 487 |
| Pergerakan stok | 248 |
| Log aktivitas | 227 |
| Kontak WhatsApp | 117 |
| Struk menunggu dikirim | 46 |
| Total omzet contoh | Rp 32.990.850 |

Kosongkan dengan `npm run seed:bersihkan` sebelum dipakai berjualan sungguhan.

---

## Belum diperiksa

| Hal | Keterangan |
|---|---|
| Tampilan di layar HP dan tablet | Dibangun mobile-first dengan Tailwind, tapi **belum dicoba di lebar layar HP sungguhan**. Ekstensi peramban yang dipakai untuk memeriksa menolak mengubah ukuran jendela |
| Pemasangan di Vercel | Berkas `vercel.json` untuk frontend dan backend sudah disiapkan, tapi belum pernah benar-benar di-deploy |
| Mencetak struk ke kertas | Memang tidak dibuat, sesuai keputusan |

---

## Masih ditunggu dari Lutfi

| No | Hal | Dibutuhkan untuk | Mendesak? |
|---|---|---|---|
| 1 | **Gambar QRIS BCA** | Layar pembayaran | Sebelum uji coba bersama tim |
| 2 | **Berkas huruf Sao Torpes & Nimbus Sans Condensed** | Huruf di struk persis sesuai merek | Sebelum hari H. Sementara dipakai pengganti terdekat: Archivo Black dan Barlow Condensed |
| 3 | **Foto produk dan menu** | Layar kasir lebih enak dipakai | Bisa menyusul, kolom dan tombol unggahnya sudah siap |
| 4 | **Keputusan kode pendaftaran** | Halaman daftar akun | Sebelum aplikasi dipasang di alamat umum |
| 5 | **Kata sandi asli untuk tiap orang** | Ketiga akun masih memakai kata sandi contoh | Sebelum dipakai berjualan |

---

## Langkah berikutnya yang disarankan

1. **Coba sendiri di HP** — buka `http://localhost:5180` dari HP yang satu jaringan Wi-Fi, atau pasang dulu di Vercel.
2. **Pasang di Vercel** — frontend dan backend sebagai dua project terpisah.
3. **Latihan bersama tim** — minta 3–7 orang memakai bersamaan, seolah-olah hari H.
4. **Kosongkan data contoh**, lalu masukkan produk dan stok yang sebenarnya.
5. **Ganti kata sandi** ketiga akun dan buat akun untuk anggota tim lainnya.

---

## Riwayat

| Tanggal | Isi |
|---|---|
| 25 September 2026 | Seluruh Gelombang 1–3 dikerjakan. Basis data, backend, frontend, data contoh, dan uji alur kasir selesai |
| 25 September 2026 | Semua isian uang tampil dalam rupiah (`Rp 35.000`) sementara yang tersimpan tetap angka polos |
| 25 September 2026 | Media bukti bayar bisa disaring dan dicari berdasarkan siapa yang mengunggah |
| 25 September 2026 | Dua akun asli dibuat: Lutfi Apriamto (pemilik) dan Ari (manajer) |
| 25 September 2026 | Antrian Kirim Struk bisa dicari berdasarkan nama pembeli, nomor telepon, atau nomor transaksi. Nomor cocok dalam bentuk `08...` maupun `62...`, termasuk kalau baru diketik sepotong |
| 25 September 2026 | Antrian Kirim Struk, Transaksi, dan Kontak WhatsApp semuanya urut dari yang paling baru |
| 25 September 2026 | Daftar Transaksi dan Stok kini langsung menyegarkan diri setelah ada transaksi baru atau pembatalan |
| 25 September 2026 | Jam transaksi contoh untuk hari ini tidak lagi melampaui jam sekarang, supaya transaksi sungguhan tidak tenggelam di bawahnya |
