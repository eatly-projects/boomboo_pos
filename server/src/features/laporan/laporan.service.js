import { kueri } from '../../shared/db/pool.js';
import * as dashboard from '../dashboard/dashboard.service.js';

/**
 * Laporan penjualan untuk satu hari atau beberapa hari.
 *
 * Angkanya sengaja memanggil ulang perhitungan yang sudah dipakai Dashboard,
 * bukan menulis kueri baru yang sejenis. Kalau ditulis dua kali, cepat atau
 * lambat salah satunya ketinggalan diperbaiki dan laporannya tidak lagi cocok
 * dengan layar - persis masalah yang pernah terjadi di project Boomboo lain.
 */

/** Seluruh transaksi beruang pada rentang itu, untuk lampiran laporan. */
async function daftarTransaksi({ tanggal_dari, tanggal_sampai }) {
  const syarat = [`t.status in ('selesai', 'ditukar')`];
  const nilai = [];

  if (tanggal_dari) {
    nilai.push(tanggal_dari);
    syarat.push(`t.dikonfirmasi_pada >= $${nilai.length}::date`);
  }
  if (tanggal_sampai) {
    nilai.push(tanggal_sampai);
    syarat.push(`t.dikonfirmasi_pada < ($${nilai.length}::date + interval '1 day')`);
  }

  const { rows } = await kueri(
    `select t.nomor, t.dikonfirmasi_pada, t.nama_kasir, t.nama_pembeli,
            t.subtotal, t.diskon_rupiah, t.total, t.uang_masuk, t.status,
            t.ditukar_dari_id is not null as hasil_tukar,
            t.bill_id is not null         as dari_bill,
            (select count(*)::int from transaksi_item i where i.transaksi_id = t.id) as jumlah_baris,
            (select coalesce(sum(i.jumlah), 0)::int from transaksi_item i where i.transaksi_id = t.id) as jumlah_barang
       from transaksi t
      where ${syarat.join(' and ')}
      order by t.dikonfirmasi_pada asc`,
    nilai
  );
  return rows;
}

/** Transaksi yang dibatalkan, supaya nomor yang loncat ada penjelasannya. */
async function daftarGagal({ tanggal_dari, tanggal_sampai }) {
  const syarat = [`t.status = 'batal'`];
  const nilai = [];

  if (tanggal_dari) {
    nilai.push(tanggal_dari);
    syarat.push(`t.dibuat_pada >= $${nilai.length}::date`);
  }
  if (tanggal_sampai) {
    nilai.push(tanggal_sampai);
    syarat.push(`t.dibuat_pada < ($${nilai.length}::date + interval '1 day')`);
  }

  const { rows } = await kueri(
    `select t.nomor, t.dibuat_pada, t.nama_kasir, t.total,
            t.alasan_batal, t.nama_pembatal
       from transaksi t
      where ${syarat.join(' and ')}
      order by t.dibuat_pada asc`,
    nilai
  );
  return rows;
}

/**
 * Rincian tiap baris barang yang keluar bukan karena dijual, LENGKAP dengan
 * catatan dan nama orangnya.
 *
 * Angka ringkasnya saja tidak cukup jujur. Pada data event 9 Oktober 2026 ada
 * satu baris beralasan "rusak" senilai Rp 5,6 juta yang catatannya berbunyi
 * "kesalahan input" - itu pembetulan salah ketik, bukan barang rusak. Tanpa
 * catatannya ikut terbawa, laporan akan terbaca seolah kerugiannya hampir
 * sebesar omzet sehari.
 */
async function stokKeluarRinci({ tanggal_dari, tanggal_sampai }) {
  const syarat = [`g.jenis = 'pengurangan_manual'`];
  const nilai = [];

  if (tanggal_dari) {
    nilai.push(tanggal_dari);
    syarat.push(`g.dibuat_pada >= $${nilai.length}::date`);
  }
  if (tanggal_sampai) {
    nilai.push(tanggal_sampai);
    syarat.push(`g.dibuat_pada < ($${nilai.length}::date + interval '1 day')`);
  }

  const { rows } = await kueri(
    `select g.dibuat_pada, p.nama as nama_produk, abs(g.jumlah)::int as jumlah,
            g.alasan, g.catatan, g.nama_user,
            (abs(g.jumlah) * coalesce(p.harga_diskon, p.harga))::int as nilai
       from pergerakan_stok g
       join produk p on p.id = g.produk_id
      where ${syarat.join(' and ')}
      order by g.dibuat_pada asc`,
    nilai
  );
  return rows;
}

export async function harian(query = {}) {
  const dari = query.tanggal_dari || query.tanggal_sampai;
  const sampai = query.tanggal_sampai || query.tanggal_dari;
  const rentang = { tanggal_dari: dari, tanggal_sampai: sampai };

  const [
    ringkasan,
    perHari,
    perJam,
    terlaris,
    perKasir,
    stokKeluar,
    pengembalian,
    transaksi,
    gagal,
    stokKeluarDetail,
  ] = await Promise.all([
    dashboard.ringkasan(rentang),
    dashboard.harian(rentang),
    dashboard.perJam(rentang),
    dashboard.terlaris({ ...rentang, batas: 50 }),
    dashboard.perKasir(rentang),
    dashboard.stokKeluarBukanJualan(rentang),
    dashboard.pengembalianUang(rentang),
    daftarTransaksi(rentang),
    daftarGagal(rentang),
    stokKeluarRinci(rentang),
  ]);

  return {
    tanggal_dari: dari || null,
    tanggal_sampai: sampai || null,
    satu_hari: Boolean(dari) && dari === sampai,
    dibuat_pada: new Date().toISOString(),
    ringkasan,
    per_hari: perHari,
    per_jam: perJam,
    terlaris,
    per_kasir: perKasir,
    stok_keluar: { ...stokKeluar, rincian: stokKeluarDetail },
    pengembalian,
    transaksi,
    gagal,
  };
}
