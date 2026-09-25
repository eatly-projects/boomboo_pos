-- =====================================================================
-- Aplikasi Kasir Boomboo - Skema Awal
-- Acuan: docs/SPESIFIKASI.md bagian 4 (Model Data)
--
-- Catatan penting soal kolom `stok` di tabel produk:
-- Kolom itu SENGAJA tidak diberi batasan `>= 0` di tingkat basis data.
-- Aturan "stok tidak boleh minus" dijalankan di backend. Pengecualiannya
-- hanya satu: aturan 5.6 di spesifikasi - kalau uang pembeli sudah masuk
-- tapi stok keburu diambil kasir lain, transaksinya tetap diloloskan.
-- Kalau angka stok dipaksa berhenti di 0 pada kasus itu, jumlah seluruh
-- baris pergerakan_stok tidak akan lagi sama dengan produk.stok, dan
-- pemeriksaan silang jadi rusak. Lebih baik angkanya jujur menunjukkan
-- kekurangan, lalu ditampilkan sebagai peringatan merah di layar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pemicu: memperbarui kolom diubah_pada secara otomatis
-- ---------------------------------------------------------------------
create or replace function set_diubah_pada()
returns trigger as $$
begin
  new.diubah_pada = now();
  return new;
end;
$$ language plpgsql;


-- ---------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------
create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null,
  email           text not null unique,
  password_hash   text not null,
  role            text not null default 'kasir',
  dibuat_pada     timestamptz not null default now(),
  diubah_pada     timestamptz not null default now(),
  diarsipkan_pada timestamptz
);

create trigger trg_users_diubah before update on users
  for each row execute function set_diubah_pada();


-- ---------------------------------------------------------------------
-- 2. produk  (barang yang punya stok)
-- ---------------------------------------------------------------------
create table if not exists produk (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null,
  harga           integer not null check (harga >= 0),
  harga_diskon    integer check (harga_diskon >= 0),
  nama_diskon     text,
  foto_url        text,
  foto_path       text,
  stok            integer not null default 0,
  diarsipkan_pada timestamptz,
  dibuat_pada     timestamptz not null default now(),
  diubah_pada     timestamptz not null default now(),

  -- nama diskon wajib diisi kalau harga diskon diisi
  constraint produk_diskon_butuh_nama
    check (harga_diskon is null or (nama_diskon is not null and length(btrim(nama_diskon)) > 0))
);

create trigger trg_produk_diubah before update on produk
  for each row execute function set_diubah_pada();

create index if not exists idx_produk_aktif on produk (diarsipkan_pada) where diarsipkan_pada is null;
create index if not exists idx_produk_nama  on produk (lower(nama));


-- ---------------------------------------------------------------------
-- 3. menu  (tanpa stok sama sekali)
-- ---------------------------------------------------------------------
create table if not exists menu (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null,
  harga           integer not null check (harga >= 0),
  harga_diskon    integer check (harga_diskon >= 0),
  nama_diskon     text,
  foto_url        text,
  foto_path       text,
  diarsipkan_pada timestamptz,
  dibuat_pada     timestamptz not null default now(),
  diubah_pada     timestamptz not null default now(),

  constraint menu_diskon_butuh_nama
    check (harga_diskon is null or (nama_diskon is not null and length(btrim(nama_diskon)) > 0))
);

create trigger trg_menu_diubah before update on menu
  for each row execute function set_diubah_pada();

create index if not exists idx_menu_aktif on menu (diarsipkan_pada) where diarsipkan_pada is null;
create index if not exists idx_menu_nama  on menu (lower(nama));


-- ---------------------------------------------------------------------
-- 4. transaksi
-- ---------------------------------------------------------------------
create table if not exists transaksi (
  id                    uuid primary key default gen_random_uuid(),
  nomor                 text not null unique,
  kode_struk            text not null unique,

  status                text not null default 'menunggu_pembayaran'
                        check (status in ('menunggu_pembayaran','selesai','batal')),
  metode_bayar          text check (metode_bayar in ('qris','tunai')),

  subtotal              integer not null default 0 check (subtotal >= 0),
  diskon_jenis          text check (diskon_jenis in ('persen','nominal')),
  diskon_nilai          integer check (diskon_nilai >= 0),
  diskon_rupiah         integer not null default 0 check (diskon_rupiah >= 0),
  total                 integer not null default 0 check (total >= 0),

  uang_diterima         integer check (uang_diterima >= 0),
  kembalian             integer check (kembalian >= 0),

  nama_pembeli          text,
  nomor_wa              text,
  status_struk          text not null default 'belum_diisi'
                        check (status_struk in ('belum_diisi','menunggu_kirim','terkirim','dilewati')),

  kasir_id              uuid references users(id),
  nama_kasir            text not null,
  dikonfirmasi_oleh_id  uuid references users(id),
  nama_pengonfirmasi    text,
  dibatalkan_oleh_id    uuid references users(id),
  nama_pembatal         text,
  alasan_batal          text,

  ditandai_stok_kurang  boolean not null default false,

  dibuat_pada           timestamptz not null default now(),
  dikonfirmasi_pada     timestamptz,
  dibatalkan_pada       timestamptz,

  -- diskon persen tidak boleh lebih dari 100
  constraint transaksi_persen_wajar
    check (diskon_jenis is distinct from 'persen' or diskon_nilai <= 100)
);

create index if not exists idx_transaksi_status  on transaksi (status);
create index if not exists idx_transaksi_tanggal on transaksi (dibuat_pada desc);
create index if not exists idx_transaksi_selesai on transaksi (dikonfirmasi_pada desc) where status = 'selesai';
create index if not exists idx_transaksi_struk   on transaksi (status_struk) where status_struk = 'menunggu_kirim';
create index if not exists idx_transaksi_kasir   on transaksi (kasir_id);


-- ---------------------------------------------------------------------
-- 5. transaksi_item  (semua nilai di sini DIBEKUKAN)
-- ---------------------------------------------------------------------
create table if not exists transaksi_item (
  id            uuid primary key default gen_random_uuid(),
  transaksi_id  uuid not null references transaksi(id) on delete cascade,

  jenis_barang  text not null check (jenis_barang in ('produk','menu')),
  barang_id     uuid not null,

  -- disalin saat transaksi dibuat, tidak pernah menunjuk ke harga sekarang
  nama_barang   text not null,
  harga_normal  integer not null check (harga_normal >= 0),
  harga_diskon  integer check (harga_diskon >= 0),
  nama_diskon   text,
  harga_dipakai integer not null check (harga_dipakai >= 0),

  jumlah        integer not null check (jumlah > 0),
  subtotal      integer not null check (subtotal >= 0),
  urutan        integer not null default 0
);

create index if not exists idx_item_transaksi on transaksi_item (transaksi_id);
create index if not exists idx_item_barang    on transaksi_item (barang_id);


-- ---------------------------------------------------------------------
-- 6. pergerakan_stok  (buku besar stok - tidak pernah diubah/dihapus)
-- ---------------------------------------------------------------------
create table if not exists pergerakan_stok (
  id            uuid primary key default gen_random_uuid(),
  produk_id     uuid not null references produk(id),

  jenis         text not null
                check (jenis in ('penambahan','pengurangan_manual','penjualan','pembatalan','opname')),
  jumlah        integer not null check (jumlah <> 0),   -- positif = masuk, negatif = keluar
  stok_sebelum  integer not null,
  stok_sesudah  integer not null,

  alasan        text,
  catatan       text,
  transaksi_id  uuid references transaksi(id),

  user_id       uuid references users(id),
  nama_user     text not null,
  dibuat_pada   timestamptz not null default now(),

  -- pengurangan manual wajib menyertakan alasan
  constraint pergerakan_alasan_wajib
    check (jenis <> 'pengurangan_manual'
           or (alasan is not null and length(btrim(alasan)) > 0)),

  -- penjualan & pembatalan wajib menempel ke transaksi
  constraint pergerakan_butuh_transaksi
    check (jenis not in ('penjualan','pembatalan') or transaksi_id is not null)
);

create index if not exists idx_pergerakan_produk    on pergerakan_stok (produk_id, dibuat_pada desc);
create index if not exists idx_pergerakan_transaksi on pergerakan_stok (transaksi_id);
create index if not exists idx_pergerakan_tanggal   on pergerakan_stok (dibuat_pada desc);


-- ---------------------------------------------------------------------
-- 7. log_aktivitas
-- ---------------------------------------------------------------------
create table if not exists log_aktivitas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id),
  nama_user    text not null,
  aksi         text not null,
  entitas      text not null,
  entitas_id   uuid,
  nama_entitas text,
  detail       jsonb,
  dibuat_pada  timestamptz not null default now()
);

create index if not exists idx_log_tanggal on log_aktivitas (dibuat_pada desc);
create index if not exists idx_log_entitas on log_aktivitas (entitas, entitas_id);
create index if not exists idx_log_user    on log_aktivitas (user_id);


-- ---------------------------------------------------------------------
-- 8. kontak_whatsapp  (aset pemasaran)
-- ---------------------------------------------------------------------
create table if not exists kontak_whatsapp (
  id               uuid primary key default gen_random_uuid(),
  nomor            text not null unique,            -- bentuk baku: 62xxxxxxxxxx
  nama             text,
  pertama_pada     timestamptz not null default now(),
  terakhir_pada    timestamptz not null default now(),
  jumlah_transaksi integer not null default 0,
  total_belanja    integer not null default 0
);

create index if not exists idx_kontak_terakhir on kontak_whatsapp (terakhir_pada desc);


-- ---------------------------------------------------------------------
-- 9. media  (berdiri sendiri, tidak menempel ke transaksi - keputusan K20)
-- ---------------------------------------------------------------------
create table if not exists media (
  id               uuid primary key default gen_random_uuid(),
  nama_berkas      text not null,
  path_berkas      text not null,
  url              text not null,
  ukuran_byte      integer,
  tipe_berkas      text,
  catatan          text,
  diunggah_oleh_id uuid references users(id),
  nama_pengunggah  text not null,
  diunggah_pada    timestamptz not null default now()
);

create index if not exists idx_media_tanggal on media (diunggah_pada desc);


-- ---------------------------------------------------------------------
-- 10. pengaturan
-- ---------------------------------------------------------------------
create table if not exists pengaturan (
  kunci          text primary key,
  nilai          text,
  diubah_oleh_id uuid references users(id),
  nama_pengubah  text,
  diubah_pada    timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 11. urutan_nomor  (penjamin nomor transaksi tidak kembar)
--     Dipakai dengan satu perintah atomik:
--       insert into urutan_nomor values (current_date, 1)
--       on conflict (tanggal) do update set terakhir = urutan_nomor.terakhir + 1
--       returning terakhir;
-- ---------------------------------------------------------------------
create table if not exists urutan_nomor (
  tanggal  date primary key,
  terakhir integer not null default 0
);


-- ---------------------------------------------------------------------
-- Pemeriksaan silang stok: jumlah buku besar HARUS sama dengan produk.stok
-- Dipakai lewat: select * from periksa_stok();
-- ---------------------------------------------------------------------
create or replace view periksa_stok as
select
  p.id,
  p.nama,
  p.stok                                   as stok_tercatat,
  coalesce(sum(g.jumlah), 0)::integer      as stok_menurut_buku,
  p.stok - coalesce(sum(g.jumlah), 0)::integer as selisih
from produk p
left join pergerakan_stok g on g.produk_id = p.id
group by p.id, p.nama, p.stok;


-- ---------------------------------------------------------------------
-- Nilai pengaturan awal
-- ---------------------------------------------------------------------
insert into pengaturan (kunci, nilai) values
  ('nama_toko',         'Boomboo'),
  ('qris_gambar_url',   null),
  ('qris_gambar_path',  null),
  ('teks_struk_bawah',  'Gurih, nagih. Terima kasih sudah belanja di Boomboo!'),
  ('kode_pendaftaran',  null)
on conflict (kunci) do nothing;
