-- =====================================================================
-- Perubahan permintaan user, 2 Oktober 2026
-- Acuan: brainstorming.md bagian 10 dan 11 (R1-R6.2, K28-K40)
--
--  R1   Hapus seluruh konsep tunai, semua pembayaran lewat QRIS
--  R2   Hapus penyimpanan gambar bukti bayar
--  R3   Tambah konsep Open Bill
--  R4   Tambah konsep tukar barang pada transaksi yang sudah dibayar
--  R5   Pengurangan stok di luar penjualan (sample, karyawan, hadiah)
--  R6   Hapus foto produk dan menu
--  R6.1 Toggle "dijual satuan" pada produk
--  R6.2 Menu bisa berisi produk berstok
-- =====================================================================


-- ---------------------------------------------------------------------
-- R1. Tunai dihapus
-- ---------------------------------------------------------------------
delete from pergerakan_stok
 where transaksi_id in (select id from transaksi where metode_bayar = 'tunai');
delete from log_aktivitas
 where entitas = 'transaksi'
   and entitas_id in (select id from transaksi where metode_bayar = 'tunai');
delete from transaksi_item
 where transaksi_id in (select id from transaksi where metode_bayar = 'tunai');
delete from transaksi where metode_bayar = 'tunai';

alter table transaksi drop column if exists uang_diterima;
alter table transaksi drop column if exists kembalian;

alter table transaksi drop constraint if exists transaksi_metode_bayar_check;
alter table transaksi
  add constraint transaksi_metode_bayar_check check (metode_bayar in ('qris'));


-- ---------------------------------------------------------------------
-- R2. Gambar bukti bayar dihapus
-- ---------------------------------------------------------------------
drop table if exists media;


-- ---------------------------------------------------------------------
-- R6. Foto produk dan menu dihapus
-- ---------------------------------------------------------------------
alter table produk drop column if exists foto_url;
alter table produk drop column if exists foto_path;
alter table menu   drop column if exists foto_url;
alter table menu   drop column if exists foto_path;


-- ---------------------------------------------------------------------
-- R6.1 Toggle "dijual satuan"
--
-- Menyala  : muncul di layar kasir, bisa dijual sendiri
-- Mati     : stoknya tetap dicatat, tapi hanya dipakai sebagai penyusun
--            menu. Contoh: mie instan yang tidak dijual satuan.
-- ---------------------------------------------------------------------
alter table produk
  add column if not exists dijual_satuan boolean not null default true;

create index if not exists idx_produk_dijual_satuan
  on produk (dijual_satuan) where diarsipkan_pada is null;


-- ---------------------------------------------------------------------
-- R6.2 Menu bisa berisi produk berstok
--
-- Satu lapis saja: menu berisi produk, tidak boleh berisi menu lain
-- (keputusan K38). Penyusunnya boleh sebagian - hanya barang yang
-- stoknya memang dicatat (keputusan K39).
-- ---------------------------------------------------------------------
create table if not exists menu_komponen (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid not null references menu(id) on delete cascade,
  produk_id  uuid not null references produk(id),
  jumlah     integer not null check (jumlah > 0),
  dibuat_pada timestamptz not null default now(),

  unique (menu_id, produk_id)
);

create index if not exists idx_komponen_menu   on menu_komponen (menu_id);
create index if not exists idx_komponen_produk on menu_komponen (produk_id);


-- ---------------------------------------------------------------------
-- R3. Open Bill
--
-- Bedanya dengan kasir biasa: stok berkurang SAAT BARANG DIINPUT, bukan
-- saat dibayar. Jadi bill yang ditinggal kabur akan menyandera stok
-- sampai ada yang membatalkannya - karena itu tombol batalkan wajib ada.
-- ---------------------------------------------------------------------
create table if not exists bill (
  id                uuid primary key default gen_random_uuid(),
  nomor             text not null unique,
  status            text not null default 'terbuka'
                    check (status in ('terbuka', 'selesai', 'batal')),

  nama_pembeli      text not null,
  nomor_wa          text,
  penanda           text,

  dibuka_oleh_id    uuid references users(id),
  nama_pembuka      text not null,
  ditutup_oleh_id   uuid references users(id),
  nama_penutup      text,
  dibatalkan_oleh_id uuid references users(id),
  nama_pembatal     text,
  alasan_batal      text,

  transaksi_id      uuid references transaksi(id),

  dibuka_pada       timestamptz not null default now(),
  ditutup_pada      timestamptz,
  dibatalkan_pada   timestamptz
);

create index if not exists idx_bill_terbuka on bill (dibuka_pada desc) where status = 'terbuka';
create index if not exists idx_bill_status  on bill (status);
create index if not exists idx_bill_nama    on bill (lower(nama_pembeli));

create table if not exists bill_item (
  id             uuid primary key default gen_random_uuid(),
  bill_id        uuid not null references bill(id) on delete cascade,

  jenis_barang   text not null check (jenis_barang in ('produk', 'menu')),
  barang_id      uuid not null,

  -- dibekukan saat barang dimasukkan, sama seperti transaksi_item
  nama_barang    text not null,
  harga_normal   integer not null check (harga_normal >= 0),
  harga_diskon   integer check (harga_diskon >= 0),
  nama_diskon    text,
  harga_dipakai  integer not null check (harga_dipakai >= 0),

  jumlah         integer not null check (jumlah > 0),
  subtotal       integer not null check (subtotal >= 0),

  ditambah_oleh_id uuid references users(id),
  nama_penambah  text not null,
  dibuat_pada    timestamptz not null default now()
);

create index if not exists idx_bill_item_bill on bill_item (bill_id);

create table if not exists urutan_nomor_bill (
  tanggal  date primary key,
  terakhir integer not null default 0
);


-- ---------------------------------------------------------------------
-- R4. Tukar barang
--
-- Transaksi lama ditandai `ditukar` (bukan dihapus), lalu dibuat
-- transaksi baru yang membawa tautan ke transaksi lama.
--
-- `uang_masuk` menyimpan uang yang BENAR-BENAR bergerak di transaksi itu.
-- Untuk penjualan biasa nilainya sama dengan total. Untuk hasil penukaran
-- nilainya hanya selisihnya, dan boleh minus kalau toko mengembalikan uang.
-- Tanpa kolom ini, omzet hari lama akan ikut hilang saat ada penukaran
-- beberapa hari kemudian (keputusan K33).
-- ---------------------------------------------------------------------
alter table transaksi drop constraint if exists transaksi_status_check;
alter table transaksi
  add constraint transaksi_status_check
  check (status in ('menunggu_pembayaran', 'selesai', 'batal', 'ditukar'));

alter table transaksi add column if not exists ditukar_dari_id uuid references transaksi(id);
alter table transaksi add column if not exists ditukar_ke_id   uuid references transaksi(id);
alter table transaksi add column if not exists uang_masuk      integer;
alter table transaksi add column if not exists ditukar_pada    timestamptz;
alter table transaksi add column if not exists bill_id         uuid references bill(id);

-- Data lama: uang yang bergerak sama dengan totalnya
update transaksi set uang_masuk = total where uang_masuk is null;

create index if not exists idx_transaksi_ditukar_dari on transaksi (ditukar_dari_id);
create index if not exists idx_transaksi_bill on transaksi (bill_id);

-- Rincian barang yang ditukar, supaya riwayatnya bisa dibaca ulang
create table if not exists penukaran_item (
  id              uuid primary key default gen_random_uuid(),
  transaksi_baru_id uuid not null references transaksi(id) on delete cascade,
  transaksi_lama_id uuid not null references transaksi(id),

  arah            text not null check (arah in ('dikembalikan', 'pengganti')),
  jenis_barang    text not null check (jenis_barang in ('produk', 'menu')),
  barang_id       uuid not null,
  nama_barang     text not null,
  harga_dipakai   integer not null,
  jumlah          integer not null check (jumlah > 0),
  subtotal        integer not null,

  dibuat_pada     timestamptz not null default now()
);

create index if not exists idx_penukaran_baru on penukaran_item (transaksi_baru_id);
create index if not exists idx_penukaran_lama on penukaran_item (transaksi_lama_id);

-- Pengembalian uang tunai saat barang pengganti lebih murah (keputusan K30)
create table if not exists pengembalian_uang (
  id            uuid primary key default gen_random_uuid(),
  transaksi_id  uuid not null references transaksi(id),
  jumlah        integer not null check (jumlah > 0),

  -- 'kantor' = uang toko, 'kasir' = ditalangi kasir, nanti di-reimburse
  sumber_dana   text not null check (sumber_dana in ('kantor', 'kasir')),
  user_id       uuid references users(id),
  nama_user     text not null,
  catatan       text,

  sudah_diganti boolean not null default false,
  diganti_pada  timestamptz,

  dibuat_pada   timestamptz not null default now()
);

create index if not exists idx_pengembalian_tanggal on pengembalian_uang (dibuat_pada desc);
create index if not exists idx_pengembalian_reimburse
  on pengembalian_uang (sumber_dana, sudah_diganti) where sumber_dana = 'kasir';


-- ---------------------------------------------------------------------
-- Buku besar stok: jenis pergerakan baru
--
--  bill_keluar      barang dimasukkan ke open bill, stok langsung turun
--  bill_kembali     barang dicabut dari bill, atau billnya dibatalkan
--  penukaran_masuk  barang dikembalikan pembeli saat tukar
--  penukaran_keluar barang pengganti diserahkan ke pembeli
-- ---------------------------------------------------------------------
alter table pergerakan_stok drop constraint if exists pergerakan_stok_jenis_check;
alter table pergerakan_stok
  add constraint pergerakan_stok_jenis_check
  check (jenis in (
    'penambahan', 'pengurangan_manual', 'penjualan', 'pembatalan', 'opname',
    'bill_keluar', 'bill_kembali', 'penukaran_masuk', 'penukaran_keluar'
  ));

alter table pergerakan_stok add column if not exists bill_id uuid references bill(id);

-- Pergerakan milik bill belum punya transaksi, jadi aturannya dilonggarkan:
-- yang wajib adalah salah satu di antara transaksi atau bill.
alter table pergerakan_stok drop constraint if exists pergerakan_butuh_transaksi;
alter table pergerakan_stok
  add constraint pergerakan_butuh_sumber
  check (
    jenis not in ('penjualan', 'pembatalan', 'penukaran_masuk', 'penukaran_keluar', 'bill_keluar', 'bill_kembali')
    or transaksi_id is not null
    or bill_id is not null
  );

create index if not exists idx_pergerakan_bill on pergerakan_stok (bill_id);


-- ---------------------------------------------------------------------
-- Pengaturan: gambar bukti bayar tidak dipakai lagi
-- ---------------------------------------------------------------------
delete from pengaturan where kunci in ('bukti_bayar_wajib');
