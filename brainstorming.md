# Brainstorming — Aplikasi Kasir (POS) Boomboo

Catatan hidup hasil diskusi Lutfi x Claude. Ditambah setiap kali kita berdiskusi.
**Belum ada satu baris kode pun yang ditulis.**

- **Dibuat:** 25 September 2026
- **Terakhir diperbarui:** 25 September 2026 (Sesi 1)
- **Tahap sekarang:** Kebutuhan dan susunan teknologi sudah lengkap. Menunggu 4 pertanyaan terakhir (J1–J4), setelah itu spesifikasi ditulis

---

## 1. Konteks

| Hal | Isi |
|---|---|
| Nama project | `pos_boomboo` |
| Bentuk | Aplikasi kasir (POS), **berbasis web**, **responsif di semua perangkat** |
| Dipakai untuk | Event / bazar, **bukan** toko permanen |
| Tanggal event | 7, 8, 9, 10, 11 Oktober 2026 (5 hari) |
| Sisa waktu | **12 hari** terhitung 25 September 2026 |
| Barang jualan | Sambal, kemungkinan bertambah produk lain |
| Kasir bersamaan | Lebih dari 2, kurang dari 8 (sekitar 3–7 orang) |
| Gerbang pembayaran | **Tidak ada.** QRIS statis BCA, konfirmasi lunas manual oleh admin |

---

## 2. Keputusan yang sudah diambil

| No | Keputusan |
|---|---|
| **K1** | **Produk dan Menu terpisah total.** Menjual Menu tidak memotong stok Produk apa pun |
| **K2** | Aplikasi **berbasis web**, dipakai beberapa user |
| **K3** | Kasir yang melayani bersamaan: **lebih dari 2, kurang dari 8** |
| **K4** | Metode bayar: **QRIS** dan **Tunai**. Tidak ada bayar campur |
| **K5** | QRIS memakai **QRIS statis BCA** — tidak bisa dipanggil lewat API, nominal tidak terkunci di QR |
| **K6** | Transaksi **tidak langsung berhasil saat kasir submit**. Stok berkurang dan riwayat masuk **hanya setelah pembayaran dikonfirmasi admin** |
| **K7** | Kasir **boleh** memberi diskon di level total transaksi — persentase **atau** nominal (pilih salah satu), tanpa batas maksimal, **tapi wajib tercatat di log**. Total tidak boleh di bawah nol |
| **K8** | Struk dikirim lewat **WhatsApp**: sapaan nama + ucapan terima kasih + total + link struk. Input pembeli: **nama (opsional)** dan **nomor WhatsApp** |
| **K9** | Ada **dashboard** yang memisahkan uang masuk QRIS vs Tunai |
| **K10** | Pengiriman WhatsApp memakai cara **semi-otomatis**: sistem menyiapkan pesan, petugas menekan kirim. Tidak memakai API resmi Meta maupun gateway tidak resmi *(jawaban G1 = c)* |
| **K11** | Tampilan **wajib responsif** di HP, tablet, dan laptop — karena perangkat kasir bisa bermacam-macam *(G2)* |
| **K12** | Foto bukti bayar QRIS **diunggah ke sistem**, tapi **tidak saat transaksi berlangsung** supaya kasir tidak bertele-tele. Ada satu **bagian Media** sebagai tempat semua bukti bayar *(G3)* |
| **K13** | Nomor WhatsApp **boleh dilewati**, tapi sangat dianjurkan. Tampilan harus mendorong pembeli mengisi, dengan tombol lewati yang tetap tersedia *(G4)* |
| **K14** | Transaksi yang batal di halaman pembayaran **dicatat sebagai batal**, tidak dihapus. Stok tidak berkurang *(G6)* |
| **K15** | Dashboard punya **penyaring (filter)** — minimal berdasarkan tanggal — dan bisa **membandingkan penjualan hari per hari** *(G7)* |
| **K16** | **Tidak ada struk cetak.** Struk hanya berupa halaman web yang linknya dikirim lewat WhatsApp. Tampilan halaman struk harus **eye catching, modern, indah, responsif, dan berwatermark** *(G8)* |
| **K17** | **Tidak ada konsep buka/tutup kasir per shift** *(F1)* |
| **K18** | Link struk memakai **kode acak** yang tidak bisa ditebak. Sapaan tetap sopan walau nama kosong. Ada **kalimat persetujuan** saat meminta nomor WhatsApp *(3 catatan kecil, semua disetujui)* |
| **K19** | User punya field: **nama, email kantor, password, tanggal dibuat, role**. Untuk sekarang **semua user bisa melakukan semua hal** — role disimpan tapi belum dipakai membatasi apa pun. Alasan: menghemat waktu, dan Lutfi percaya pada timnya |
| **K20** | **Bagian Media berdiri sendiri.** Bukti bayar yang diunggah **tidak menempel ke transaksi tertentu** — cuma kumpulan berkas di satu tempat. Ini keputusan Lutfi setelah Claude menyampaikan risikonya *(H1)* |
| **K21** | Susunan teknologi ditetapkan Lutfi — lihat bagian 2.1 *(H2)* |
| **K22** | Pembagian gelombang pengerjaan **disetujui** — lihat bagian 8 *(H3)* |
| **K24** | Gambar QRIS **diunggah ke sistem** lewat halaman Pengaturan, dan **bisa diganti** kapan saja *(J1)* |
| **K25** | Nama merek **Boomboo**. Seluruh identitas visual mengacu pada `BO_BrandBook_2024.pdf`. Logo dan ikon sudah ditarik keluar ke folder `brand-assets/` *(J2)* |
| **K26** | **Halaman pendaftaran akun tetap ada dan terbuka.** Claude sudah menyampaikan risikonya, Lutfi tetap memilih ini *(J3)* |
| **K27** | **Produk dan Menu punya foto masing-masing.** Jumlah produk & menu menyusul *(J4)* |
| **K23** | S2, S3, S4, S5, S6, S10 **disetujui semua** (harga dibekukan, stok pakai buku pergerakan, hapus berarti arsip, pengurangan stok wajib beralasan, aplikasi online penuh tanpa mode offline, transaksi yang uangnya sudah masuk tetap diloloskan tapi ditandai) |

---

## 2.1 Susunan teknologi — ditetapkan Lutfi

### Frontend

| Bagian | Pilihan |
|---|---|
| Framework | **Vite + React**, memakai **JavaScript — bukan TypeScript** |
| Styling | **Tailwind CSS**, ditambah beberapa komponen **shadcn** |
| Pengelolaan state | **Zustand** + **TanStack Query** |
| Paket npm lain | axios, react-hot-toast, react-icons, react-router-dom, dan lainnya sesuai kebutuhan |
| Arsitektur | **Feature Driven Development (FDD)** |

### Backend

| Bagian | Pilihan |
|---|---|
| Bahasa & landasan | **JavaScript + Node.js** — bukan TypeScript |
| Framework | **Express.js** |
| Paket npm | nodemon (khusus tahap pengembangan), dan lainnya sesuai kebutuhan |
| Arsitektur | **Feature Driven Development (FDD)**, sama seperti frontend |

### Basis data & penempatan

| Bagian | Pilihan |
|---|---|
| Basis data | **Supabase** — PostgreSQL |
| Penyimpanan berkas | **Supabase Storage** (untuk bukti bayar di bagian Media) |
| Penempatan | **Vercel**, frontend dan backend **di-deploy terpisah**. Kode harus disesuaikan dengan lingkungan Vercel |

---

## 3. Dua jenis barang jualan

| | **Produk** | **Menu** |
|---|---|---|
| Contoh | Botol sambal | Paket menu makan |
| Punya stok? | **Ya** — bisa bertambah & berkurang | **Tidak sama sekali** |
| Alasan dipisah | Logika stok berdiri sendiri | Tidak perlu diurus stoknya (lihat K1) |

---

## 4. Detail yang dijelaskan Lutfi

> Bagian ini murni apa yang Lutfi katakan. Tafsiran & saran Claude ada di bagian 6 dan 7.

### 4.1 Tambah Produk (barang yang punya stok)

User **hanya** mengisi 4 hal: nama produk, harga produk, harga diskon (opsional), nama harga diskon (hanya aktif kalau harga diskon diisi).

- Stok produk baru **selalu dimulai dari angka 0**. Jumlah stok sengaja tidak ada di form ini.
- Alasan pemisahan: Lutfi ingin logika stok berdiri sendiri dan dijaga ketat.
- Alasan ada dua harga: harga normal tetap tercatat sebagai patokan, sementara saat event produk bisa dijual memakai harga diskon.

### 4.2 Stok

- Ada fitur **stok opname**: mencocokkan jumlah barang fisik dengan catatan sistem.
- **Menambah stok** dicatat di log: berapa + siapa.
- **Mengurangi stok** dicatat di log juga.
- **Stok tidak boleh minus.**
- Pengurangan di sini adalah pengurangan **manual oleh petugas**, bukan pengurangan otomatis saat barang terjual.

### 4.3 Menu (tanpa stok)

Field: nama menu, harga menu, harga diskon menu, nama diskon. Sistem hanya mencatat siapa yang menambah, mengubah, atau menghapus. Tidak ada urusan stok.

### 4.4 Log / riwayat aktivitas

- Tambah / ubah / hapus **produk** — aktivitas apa + nama user pelakunya
- Tambah / ubah / hapus **menu** — aktivitas apa + nama user pelakunya
- **Penambahan stok** — jumlahnya + nama user
- **Pengurangan stok manual** — jumlahnya + nama user
- **Perubahan diskon** (harga diskon dan nama diskon, produk maupun menu) — riwayatnya tercatat

### 4.5 Alur kasir — pembayaran QRIS

1. Pembeli datang ke kasir untuk membayar
2. Kasir memasukkan barang ke keranjang
3. Kasir menekan submit — **transaksi BELUM berhasil**
4. Layar pindah ke halaman pembayaran: **kode QR** + **total yang harus dibayar**
5. Pembeli memindai QR *(di luar sistem)*
6. Pembeli mengetik sendiri nominalnya di HP masing-masing *(di luar sistem)*
7. Pembeli menunjukkan bukti bayar, admin memotretnya *(di luar sistem)*
8. Admin menekan submit — **di sinilah transaksi berhasil**, stok berkurang, riwayat masuk

### 4.6 Alur kasir — pembayaran Tunai

Sistem menghitung total, kasir memasukkan jumlah uang yang diserahkan pembeli, sistem membantu menghitung kembaliannya.

### 4.7 Struk lewat WhatsApp

Ini strategi bisnis Lutfi, bukan sekadar fitur teknis.

1. Pembayaran berhasil
2. Pembeli diminta memasukkan **nama (opsional)** dan **nomor WhatsApp**
3. Sistem menyiapkan pesan berisi: **sapaan nama**, **ucapan terima kasih**, **total harga yang dibayarkan**, dan **link struk**
4. Petugas menekan kirim *(cara semi-otomatis, lihat K10 dan S7)*
5. **Sistem menyimpan semua nomor WhatsApp yang pernah dihubungi**

Halaman struk yang dibuka lewat link itu harus **eye catching, modern, indah, responsif di berbagai perangkat, dan ada watermark**.

Catatan Claude: karena nama boleh kosong, pesannya harus tetap enak dibaca tanpa nama. Sapaan cadangan misalnya *"Halo Kak,"* — jangan sampai muncul *"Halo ,"*.

### 4.8 Dashboard uang masuk

Memisahkan uang yang masuk lewat QRIS dan lewat tunai. Ada penyaring (minimal berdasarkan tanggal) dan bisa membandingkan penjualan hari per hari.

### 4.9 Bagian Media

Satu tempat khusus untuk menyimpan semua bukti bayar yang diunggah. Unggahannya dilakukan belakangan, bukan saat transaksi berlangsung, supaya kasir tidak bertele-tele.

### 4.10 User

Field: **nama, email kantor, password, tanggal dibuat, role**.

Untuk sekarang **semua user bisa melakukan semua hal** — pembatasan hak akses sengaja ditunda demi menghemat waktu. Role tetap disimpan supaya nanti tinggal diaktifkan.

---

## 5. Semua pertanyaan yang sudah terjawab

| No | Pertanyaan | Jawaban |
|---|---|---|
| T1 | Menu memotong stok Produk? | Tidak, dipisah total (**K1**) |
| T2 | Bentuk aplikasi | Web, multi-user (**K2**) |
| T3 | Berapa kasir bersamaan | 3–7 orang (**K3**) |
| A1 | Campur Produk + Menu dalam satu struk | Boleh |
| A2 | Harga diskon otomatis dipakai | Ya, otomatis |
| A3 | Kasir boleh diskon dadakan | **Boleh**, di level total transaksi (**K7**) |
| B1 | Stok 0 diblok | Ya, diblok |
| B2 | Stok berkurang kapan | Setelah pembayaran dikonfirmasi (**K6**) |
| B3 | Penjualan masuk buku pergerakan yang sama | Ya, satu buku |
| C1 | Metode bayar | QRIS statis BCA + Tunai (**K4**, **K5**) |
| C2 | Hitung kembalian otomatis | Perlu |
| C3 | Bayar campur | Tidak |
| D2 | Nomor urut transaksi | Perlu |
| E1 | Transaksi bisa dibatalkan | Ya |
| E2 | Stok kembali kalau dibatalkan | Ya, sebagai baris pergerakan baru |
| G1 | Cara kirim WhatsApp | **Semi-otomatis** (**K10**) |
| G2 | Perangkat kasir | Bermacam-macam, harus responsif (**K11**) |
| G3 | Foto bukti bayar | Diunggah ke sistem, belakangan, di bagian Media (**K12**) |
| G4 | Nomor HP wajib? | Boleh dilewati tapi sangat dianjurkan (**K13**) |
| G5 | Aturan diskon kasir | Ya, ikut rekomendasi (**K7**) |
| G6 | Transaksi batal | Dicatat sebagai batal (**K14**) |
| G7 | Pecahan dashboard | Pakai penyaring + komparasi harian (**K15**) |
| G8 | Struk cetak | Tidak ada, hanya WhatsApp (**K16**) |
| F1 | Buka/tutup kasir per shift | Tidak ada (**K17**) |
| — | 3 catatan kecil (link acak, sapaan cadangan, kalimat persetujuan) | Semua disetujui (**K18**) |
| — | User & hak akses | Semua user bisa semua hal untuk sekarang (**K19**) |

---

## 6. Yang masih harus diputuskan

### 6.1 Sudah terjawab

| No | Pertanyaan | Jawaban Lutfi |
|---|---|---|
| H1 | Bukti bayar menempel ke transaksi atau berdiri sendiri? | **Berdiri sendiri** (**K20**). Claude sudah menyampaikan risikonya, Lutfi tetap memilih ini |
| H2 | Susunan teknologi | Ditetapkan lengkap oleh Lutfi, lihat bagian 2.1 (**K21**) |
| H3 | Pembagian gelombang pengerjaan | **Setuju** (**K22**) |
| S2–S6, S10 | Enam saran teknis | **Disetujui semua** (**K23**) |

### 6.2 Empat pertanyaan terakhir — sudah terjawab

| No | Pertanyaan | Jawaban Lutfi |
|---|---|---|
| J1 | Gambar QRIS diunggah ke sistem? | **Ya, diunggah dan bisa diganti** (**K24**) |
| J2 | Nama merek & watermark | **Boomboo**, ikuti `BO_BrandBook_2024.pdf` (**K25**) |
| J3 | Ada halaman pendaftaran terbuka? | **Ada** (**K26**) |
| J4 | Berapa Produk + Menu, pakai foto? | Jumlah menyusul. **Pakai foto masing-masing** (**K27**) |

### 6.3 Masih ditunggu dari Lutfi

1. **Gambar QRIS BCA** — belum ada, akan diberikan nanti
2. **Kira-kira berapa Produk + Menu** — menentukan apakah layar kasir perlu kotak pencarian
3. **Berkas huruf Sao Torpes & Nimbus Sans Condensed** dari folder Google Drive merek — brand book menyebut berkasnya ada di sana. Sementara belum ada, dipakai huruf pengganti yang bentuknya paling mendekati
4. **Keputusan kode pendaftaran** — lihat bagian 11 di `docs/SPESIFIKASI.md`
5. **Foto produk & menu**

---

## 7. Saran Claude

### S1. Waktu tinggal 12 hari, cakupan harus dikunci — **lihat bagian 8**

### S2. Harga harus dibekukan di setiap transaksi

Saat penjualan terjadi, harga yang dipakai **disalin dan disimpan ke dalam transaksi itu**, bukan menunjuk ke harga produk yang berlaku sekarang. Kalau tidak, saat harga diubah di hari ke-3, laporan hari ke-1 dan ke-2 ikut berubah angkanya.

Yang harus dibekukan: harga satuan, diskon produk, **dan diskon total yang diberikan kasir**.

**Penegasan (pertanyaan Lutfi, 25 Sep):** pembekuan ini **tidak** mengubah apa yang tampil di layar. Halaman produk dan layar kasir tetap menampilkan **harga yang berlaku sekarang** dan **stok yang ada sekarang** seperti biasa. Yang dibekukan hanya angka yang **sudah tersimpan di dalam transaksi yang selesai**, supaya struk dan laporan hari-hari sebelumnya tidak ikut berubah saat harga diubah di tengah event.

### S3. Stok dihitung dari buku pergerakan, bukan satu angka yang ditimpa

Setiap pergerakan jadi satu baris: `+100 masuk`, `-3 terjual`, `-2 rusak`. Stok sekarang = jumlah semua baris. Angka stok selalu bisa dipertanggungjawabkan asal-usulnya, dan kartu stok per produk langsung ada tanpa kerja tambahan — persis log yang Lutfi minta.

### S4. Hapus berarti arsip, bukan hilang permanen

Kalau produk yang sudah pernah terjual dihapus permanen, laporan penjualan jadi rusak. Tombol hapus membuat produk hilang dari layar kasir, datanya tetap ada untuk laporan dan log.

### S5. Pengurangan stok manual wajib memilih alasan

Selain *berapa* dan *siapa*, catat juga *kenapa* — rusak, tumpah, hilang, atau koreksi hitungan.

### S6. Aplikasi online penuh + rencana cadangan

Kalau sinyal di lokasi mati, kasir tidak bisa jualan. Fitur offline-lalu-sinkron jauh lebih rumit dan berisiko tidak selesai dalam 12 hari. Rekomendasi: online penuh, ditambah tethering dari 2 HP beda operator dan nota kertas sebagai cadangan terakhir.

### S7. Cara mengirim WhatsApp — **sudah diputuskan: semi-otomatis (K10)**

Rancangannya supaya antrian kasir tidak terganggu:

1. Kasir hanya mencatat nama + nomor, lalu **langsung lanjut melayani pembeli berikutnya**
2. Transaksi itu masuk ke halaman **"Antrian Kirim Struk"**
3. Satu orang yang sedang senggang membuka halaman antrian di **satu HP dengan nomor WhatsApp resmi Boomboo**, lalu menekan kirim satu per satu

Semua pesan keluar dari **satu nomor resmi**, bukan nomor pribadi kasir yang berganti-ganti. Bagian pengirim pesan dibuat **terpisah rapi**, sehingga kalau nanti mau naik ke API resmi Meta, yang diganti cuma satu bagian kecil.

### S8. Link struk memakai kode acak — **disetujui (K18)**

Jangan memakai nomor urut seperti `/struk/1` — orang tinggal mengganti angkanya untuk mengintip struk orang lain.

### S9. Kalimat persetujuan saat menyimpan nomor — **disetujui (K18)**

Contoh: *"Nomor Anda kami simpan untuk mengirim struk dan informasi promo Boomboo."*

### S10. Kalau stok habis di tengah proses pembayaran

Dengan 3–7 kasir bersamaan, bisa terjadi dua kasir berada di halaman pembayaran untuk botol terakhir, dan keduanya sudah menerima uang. Menolak transaksi yang **uangnya sudah masuk** adalah pilihan terburuk.

Rekomendasi: cek stok di dua titik (saat masuk keranjang **dan** saat masuk halaman pembayaran) supaya kejadiannya sangat jarang. Kalau tetap terjadi di submit terakhir, **loloskan transaksinya** tapi tandai dan munculkan peringatan. Selisihnya ketahuan saat stok opname.

---

## 8. Usulan pembagian gelombang pengerjaan

**Tenggat sebenarnya bukan 7 Oktober, tapi sekitar 3–4 Oktober.** Sisa harinya dipakai untuk mencoba beneran, memperbaiki, dan memasukkan data produk + stok awal. Aplikasi kasir yang baru pertama kali dipakai di hari H adalah resep bencana.

Selama event berlangsung (7–11 Oktober) masih ada kesempatan memperbaiki dan menambah fitur tiap malam.

### Gelombang 1 — wajib siap sebelum 4 Oktober

Tanpa ini, tidak bisa jualan sama sekali.

1. Login user + kelola user
2. Kelola Produk & Menu (beserta log)
3. Stok: tambah, kurang, buku pergerakan
4. Kasir: keranjang, diskon total, alur QRIS, alur tunai, konfirmasi pembayaran, stok berkurang
5. Dashboard dasar: uang masuk QRIS vs Tunai per hari

### Gelombang 2 — strategi bisnis, dikejar sebelum 7 Oktober

6. Input nama + nomor WhatsApp setelah pembayaran
7. Halaman struk yang indah + watermark
8. Halaman antrian kirim struk WhatsApp
9. Halaman log aktivitas yang bisa dilihat

### Gelombang 3 — boleh menyusul di sela-sela event

10. Bagian Media (unggah bukti bayar)
11. Stok opname
12. Penyaring tanggal + komparasi penjualan harian di dashboard

---

## 9. Riwayat diskusi

### Sesi 1 — 25 September 2026

- Claude menjelaskan daftar fitur POS pada umumnya sebagai bahan referensi.
- Lutfi menjelaskan konteks event, pemisahan Produk vs Menu, aturan stok, dan kebutuhan log.
- Claude mengajukan T1–T3 dan saran S1–S5. Lutfi menjawab T1–T3.
- Claude menambah S6 dan pertanyaan Kasir A1–F1.
- Lutfi meluruskan A3 (diskon kasir boleh), menyetujui sisa rekomendasi, lalu menjelaskan alur pembayaran QRIS & tunai, jumlah kasir, struk WhatsApp, dan dashboard uang masuk.
- Claude menambah S7–S10 dan pertanyaan G1–G8.
- Lutfi menjawab seluruh G1–G8, F1, 3 catatan kecil, dan menjelaskan bagian User. Menjadi **K10–K19**.
- Claude menyusun usulan pembagian gelombang dan mengajukan 3 keputusan terakhir H1–H3.
- Lutfi menjawab H1 (Media berdiri sendiri), H2 (susunan teknologi lengkap), H3 (setuju gelombang), dan menyetujui S2–S6 serta S10. Menjadi **K20–K23**.
- Lutfi bertanya apakah pembekuan harga membuat layar tidak menampilkan stok/harga terkini. Dijawab: tidak, lihat penegasan di S2.
- Claude mengajukan 4 pertanyaan terakhir J1–J4.
- Lutfi menjawab seluruh J1–J4, memberikan `BO_BrandBook_2024.pdf` dan berkas pengaturan Supabase, lalu meminta Claude mulai mengerjakan. Menjadi **K24–K27**.
- Claude membaca brand book (56 halaman), menarik logo & ikon ke folder `brand-assets/`, lalu menulis **`docs/SPESIFIKASI.md` versi 1.0**.
- Lutfi memilih tidak meninjau spesifikasi dulu dan meminta seluruhnya langsung dikerjakan, ditambah 3 akun user dan data contoh yang cukup banyak.

### Sesi 2 — 25 September 2026 (pengerjaan)

- Seluruh **Gelombang 1, 2, dan 3** dikerjakan sekaligus: basis data, backend, frontend, data contoh, dan uji alur kasir otomatis.
- Rincian apa yang sudah jadi, apa yang sudah diperiksa, dan apa yang belum ada di **`docs/PROGRESS.md`**.
- Keadaan sekarang: aplikasi bisa dipakai berjualan dari awal sampai struk terkirim, dan sudah lulus 27 pemeriksaan otomatis (`npm run uji`).
