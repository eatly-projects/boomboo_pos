# Catatan Kemajuan — Aplikasi Kasir Boomboo

**Terakhir diperbarui:** 2 Oktober 2026
**Event:** 7–11 Oktober 2026 (tinggal 5 hari lagi)

---

## Ringkasan

Gelombang 1–3 sudah selesai sejak 25 September. Pada 2 Oktober seluruh
permintaan perubahan dari user (R1–R6.2) juga dikerjakan dan diuji.

| | Jumlah |
|---|---|
| Tabel basis data | 17 |
| Fitur backend | 12 |
| Halaman frontend | 19 |
| Uji alur kasir otomatis | 98 pemeriksaan |

---

## Sudah selesai

### Gelombang 1 — inti berjualan

| Bagian | Keadaan | Catatan |
|---|---|---|
| Basis data & migrasi | Selesai | Migrasi sekarang dicatat, jadi tidak pernah dijalankan dua kali |
| Masuk, daftar, kelola user | Selesai | bcrypt + JWT, kata sandi punya tombol lihat |
| Produk (tambah, ubah, arsip) | Selesai | Stok selalu mulai 0, sesuai keputusan |
| Menu makan | Selesai | Bisa berdiri sendiri, bisa juga punya penyusun berstok |
| Stok: tambah, kurang, buku pergerakan | Selesai | Pengurangan wajib beralasan, 7 pilihan alasan |
| Kartu stok per produk | Selesai | Seluruh riwayat keluar-masuk |
| Kasir: keranjang, diskon, QRIS | Selesai | Hanya QRIS, tidak ada tunai |
| Konfirmasi & pembatalan pembayaran | Selesai | Pembatalan mengembalikan stok lewat baris baru |
| Pengaturan gambar QRIS | Selesai | Bisa diunggah dan diganti kapan saja |
| Dashboard uang masuk | Selesai | Per hari, per kasir, barang terlaris |

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
| Stok opname | Selesai | Yang tidak diisi dilewati, yang pas tidak dicatat |
| Penyaring tanggal & perbandingan harian | Selesai | Ada di Dashboard dan Transaksi |

### Gelombang 4 — permintaan user, 2 Oktober 2026

| Permintaan | Keadaan |
|---|---|
| **R1** Hapus seluruh konsep tunai | Selesai. 72 transaksi tunai lama ikut dihapus. Kolom uang diterima dan kembalian dibuang |
| **R2** Hapus unggah gambar bukti bayar | Selesai. Tabel dan halaman Media dihapus total |
| **R3** Open Bill | Selesai. Menu baru, stok langsung berkurang saat barang diinput |
| **R4** Tukar barang | Selesai. Transaksi lama ditandai `ditukar`, transaksi baru membawa riwayat penukaran |
| **R5** Stok keluar di luar penjualan | Selesai. Alasan jadi 7 pilihan, ditambah laporan nilainya |
| **R6** Hapus foto produk dan menu | Selesai. Layar kasir sekarang memakai ikon |
| **R6.1** Toggle dijual satuan | Selesai. Produk yang dimatikan tetap dicatat stoknya tapi tidak muncul di kasir |
| **R6.2** Menu berisi produk berstok | Selesai. Sisa porsi dihitung dari penyusun yang paling sedikit |

---

## Yang berubah di basis data pada 2 Oktober

Enam tabel baru, satu dihapus. Sekarang 17 tabel.

| Tabel | Isinya |
|---|---|
| `menu_komponen` | Penyusun menu: produk apa, berapa banyak untuk satu porsi |
| `bill` | Tagihan yang masih berjalan |
| `bill_item` | Isi tagihan, harganya dibekukan saat dimasukkan |
| `urutan_nomor_bill` | Penjamin nomor bill tidak kembar |
| `penukaran_item` | Rincian barang yang ditukar, supaya riwayatnya bisa dibaca ulang |
| `pengembalian_uang` | Uang tunai yang dikembalikan, beserta sumber dananya |
| ~~`media`~~ | Dihapus |

Kolom penting yang ditambahkan ke `transaksi`: `uang_masuk`, `ditukar_dari_id`,
`ditukar_ke_id`, `ditukar_pada`, dan `bill_id`.

---

## Keputusan teknis yang paling menentukan

**`uang_masuk` dipisahkan dari `total`.** Ini yang menjaga laporan harian tetap jujur saat ada
penukaran. Transaksi lama tetap menyimpan uang yang dulu benar-benar masuk, dan transaksi
penggantinya hanya menyimpan selisihnya. Kalau omzet dihitung dari `total` seperti sebelumnya,
uang hari Senin akan ikut pindah ke hari Rabu begitu barangnya ditukar.

**Stok transaksi dari Open Bill tidak dipotong dua kali.** Stoknya sudah berkurang satu per satu
saat barang dimasukkan ke bill, jadi saat pembayaran dikonfirmasi pemotongannya dilewati dan
baris pergerakan milik bill ditempelkan ke nomor transaksinya.

**Kebutuhan stok dihitung sebagai satu peta.** Produk menghabiskan dirinya sendiri, menu
menghabiskan penyusunnya, dan keduanya dijumlahkan dulu sebelum diperiksa. Dengan begitu kasus
"paket berisi air mineral, lalu air mineralnya juga dibeli satuan di keranjang yang sama" tetap
terhitung benar.

---

## Sudah diperiksa

### Uji alur kasir otomatis — `npm run uji`

**98 pemeriksaan, semuanya lulus**, terbagi 12 bagian:

| Bagian | Yang dibuktikan |
|---|---|
| 1. Hanya QRIS | Tidak ada transaksi tunai tersisa, kolom uang diterima dan kembalian sudah hilang, metode selain QRIS ditolak |
| 2. Gambar sudah hilang | Alamat unggah foto produk dan tabel media sudah mati (HTTP 404) |
| 3. Toggle dijual satuan | Produk yang dimatikan tidak muncul di kasir, stoknya tetap dicatat, dan menjualnya satuan ditolak |
| 4. Menu berisi produk | Sisa porsi tampil, stok penyusun baru berkurang setelah dibayar, sesuai resep |
| 5. Menu diblokir | Menjual melebihi sisa porsi ditolak, dan pesannya menyebut nama produk penyusunnya |
| 6. Alasan stok keluar | 7 alasan tersedia, laporan memisahkan "sengaja" dari "kerusakan" |
| 7. Open Bill | Stok langsung berkurang saat barang masuk bill, dicabut berarti kembali, **jumlahnya bisa dinaikkan dan diturunkan dengan stok ikut bergerak**, harga tetap beku, ditutup jadi transaksi, **stok tidak dipotong dua kali**, struk langsung masuk antrian |
| 8. Bill dibatalkan | Seluruh stok kembali, dan bill yang sudah batal tidak bisa ditambah barang |
| 9. Tukar barang lebih mahal | Selisih positif, stok bergerak dua arah, transaksi lama ditandai `ditukar`, **uang hari lama tidak ikut pindah**. Termasuk penandaan: tanda "hasil tukar" tetap menempel walaupun transaksinya kemudian dibatalkan |
| 10. Tukar barang lebih murah | Tanpa memilih sumber dana ditolak, pengembalian uang tercatat, laporan talangan kasir terisi |
| 11. Penjagaan data | Beli melebihi stok ditolak, kurangi stok tanpa alasan ditolak, produk yang masih dipakai menu tidak bisa diarsipkan, **jumlah buku besar cocok dengan angka stok di semua produk** |
| 12. Log aktivitas | Buka/tambah/tutup/batal bill, tukar barang, dan kurangi stok semuanya tercatat beserta nama pelakunya |

Pemeriksaan stok yang harus pas sampai satuan sekarang dihitung dari **kartu stok** milik
operasi itu sendiri, bukan dari angka stok produk. Dengan begitu hasil uji tetap benar
walaupun kasir lain sedang berjualan di saat yang sama.

### Diperiksa langsung di peramban

Halaman Masuk, Kasir, Stok, Dashboard, Antrian Kirim Struk, dan Struk Publik
sudah dibuka dan tampil benar dengan data sungguhan.

---

## Basis data: pindah ke Supabase milik user (2 Oktober 2026)

Aplikasi kasir sekarang memakai **basis data yang sama dengan aplikasi Boomboo
yang lain**, tetapi di **skema terpisah** bernama `pos`.

| Hal | Isinya |
|---|---|
| Alamat | Pooler Supabase `aws-1-ap-southeast-1.pooler.supabase.com`. Alamat langsung `db.<ref>.supabase.co` **tidak bisa dipakai** dari jaringan ini |
| Porta | 6543 (pooler transaksi) untuk aplikasi, 5432 (pooler sesi) juga jalan |
| Skema | `pos` - 17 tabel, terpisah dari 49 tabel milik aplikasi lain di `public` |
| Pengunci | Jalur pencarian tabel dipaksa ke `pos, extensions` di `src/shared/db/pool.js`. **Skema `public` sengaja tidak ikut** |

Artinya: kalau ada nama tabel yang salah ketik, aplikasi langsung galat, bukan
diam-diam membaca atau menimpa tabel milik aplikasi sebelah. Sudah dibuktikan
lewat `npm run uji:pindah` - 35 pemeriksaan, semuanya lulus, termasuk
memastikan tabel `ingredients`, `purchase_orders`, `products`, dan `profiles`
benar-benar tidak terlihat dari aplikasi kasir.

### Pengaturan yang perlu dipasang di Vercel

| Nama | Isi |
|---|---|
| `DATABASE_URL` | Alamat pooler porta 6543 milik user |
| `DB_SCHEMA` | `pos` |

### Isi basis data sekarang

| | Jumlah |
|---|---|
| Akun pengguna | 6, seluruhnya memakai kata sandi yang baru |
| Produk | 11, diambil dari `docs/Price List CBE.xlsx` bagian PRODUCT |
| Stok | 0 untuk semua produk |
| Menu | 0 - bagian MAKANAN di berkas itu belum dimasukkan |
| Transaksi, bill, log | kosong |

### Perintah yang tersedia

| Perintah | Gunanya |
|---|---|
| `npm run migrate` | Membuat seluruh tabel di skema `pos` |
| `npm run seed:user -- "<sandi>"` | Membuat 6 akun, semuanya memakai kata sandi itu |
| `npm run seed:produk` | Mengisi 11 produk dari daftar harga |
| `npm run seed:bersihkan -- --simpan-user` | Mengosongkan data tapi akun tetap ada |
| `npm run uji:pindah` | Memastikan sekat antar aplikasi masih rapat |

---

## Data contoh (tidak lagi dipakai di basis data user)

Tersebar di 7 hari, 26 September – 2 Oktober 2026.

| | Jumlah |
|---|---|
| User | 5 |
| Produk | 15 (3 di antaranya tidak dijual satuan) |
| Menu | 9 (4 punya penyusun berstok) |
| Transaksi | 203 — 194 selesai, 6 ditukar, 3 batal |
| Baris barang terjual | 566 |
| Open Bill | 22, 9 di antaranya masih terbuka |
| Penukaran barang | 12 baris |
| Pengembalian uang | 3 |
| Pergerakan stok | 514 |
| Log aktivitas | 372 |
| Kontak WhatsApp | 137 |
| Struk menunggu dikirim | 52 |
| Total uang masuk | Rp 38.976.300 |

Kosongkan dengan `npm run seed:bersihkan` sebelum dipakai berjualan sungguhan.

> **Catatan:** `npm run seed` memakan waktu lebih dari setengah jam karena setiap
> perintah bolak-balik ke Supabase. Bagian Open Bill-nya dipisah ke
> `npm run seed:bill` supaya bisa dijalankan sendiri kalau seed utama putus di tengah.

---

## Belum diperiksa

| Hal | Keterangan |
|---|---|
| Tampilan halaman **Open Bill** dan **Tukar Barang** di peramban | Keduanya lulus uji lewat API dan `npm run build` berhasil, tapi **belum pernah dilihat di layar**. Ekstensi peramban yang dipakai untuk memeriksa sedang terputus |
| Latihan 3–7 kasir bersamaan | Penguncian baris sudah dipasang, tapi belum pernah dicoba beneran bersamaan |
| Mencetak struk ke kertas | Memang tidak dibuat, sesuai keputusan |

---

## Masih ditunggu dari Lutfi

| No | Hal | Dibutuhkan untuk | Mendesak? |
|---|---|---|---|
| 1 | **Gambar QRIS BCA** | Layar pembayaran | Sebelum uji coba bersama tim |
| 2 | **Berkas huruf Sao Torpes & Nimbus Sans Condensed** | Huruf di struk persis sesuai merek | Sebelum hari H. Sementara dipakai pengganti terdekat: Archivo Black dan Barlow Condensed |
| 3 | **Keputusan kode pendaftaran** | Halaman daftar akun | Sebelum aplikasi dipasang di alamat umum |
| 4 | **Daftar produk dan stok sebenarnya** | Menggantikan data contoh | Sebelum hari H |

---

## Langkah berikutnya yang disarankan

1. **Buka halaman Open Bill dan Tukar Barang di HP**, pastikan tampilannya enak dipakai.
2. **Latihan bersama tim** — minta 3–7 orang memakai bersamaan, seolah-olah hari H.
3. **Kosongkan data contoh** dengan `npm run seed:bersihkan`, lalu masukkan produk dan stok yang sebenarnya.
4. **Buat akun** untuk seluruh anggota tim yang akan jadi kasir.

---

## Riwayat

| Tanggal | Isi |
|---|---|
| 25 September 2026 | Seluruh Gelombang 1–3 dikerjakan. Basis data, backend, frontend, data contoh, dan uji alur kasir selesai |
| 25 September 2026 | Semua isian uang tampil dalam rupiah (`Rp 35.000`) sementara yang tersimpan tetap angka polos |
| 25 September 2026 | Dua akun asli dibuat: Lutfi Apriamto (pemilik) dan Ari (manajer) |
| 25 September 2026 | Antrian Kirim Struk bisa dicari berdasarkan nama pembeli, nomor telepon, atau nomor transaksi, termasuk kalau baru diketik sepotong |
| 25 September 2026 | Antrian Kirim Struk, Transaksi, dan Kontak WhatsApp semuanya urut dari yang paling baru |
| 30 September 2026 | Pemasangan di Vercel diperbaiki (frontend dan backend sebagai dua project terpisah) |
| 1 Oktober 2026 | Tombol tidak lagi gepeng dan tidak lagi tertutup bilah tombol bawaan HP |
| **2 Oktober 2026** | **R1–R6.2 dikerjakan seluruhnya dalam satu hari: tunai dihapus, gambar dihapus, Open Bill, Tukar Barang, alasan stok keluar, foto dihapus, toggle dijual satuan, dan menu berpenyusun** |
| 2 Oktober 2026 | Uji alur kasir diperluas dari 27 jadi 79 pemeriksaan, dan dibuat tahan terhadap kasir lain yang berjualan bersamaan |
| 2 Oktober 2026 | Open Bill: menambah barang harus dinyalakan dulu lewat saklar, dan jumlah tiap baris bisa diubah selagi bill terbuka dengan stok ikut bergerak. Uji jadi 98 pemeriksaan |
| 2 Oktober 2026 | Penandaan transaksi dipisah jadi dua: **Keadaan** (Berhasil / Gagal / Sudah ditukar / Menunggu pembayaran) dan **Asal** ("Hasil tukar"). Keduanya bisa disaring bersamaan. Uji jadi 87 pemeriksaan |
