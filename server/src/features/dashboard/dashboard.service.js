import { kueri } from '../../shared/db/pool.js';
import { ALASAN_BUKAN_RUSAK } from '../../shared/stok/pergerakan.js';

/**
 * Semua pembayaran sekarang lewat QRIS (R1), jadi tidak ada lagi pemisahan
 * tunai dan non-tunai.
 *
 * Angka uang dihitung dari kolom `uang_masuk`, BUKAN dari `total`. Bedanya
 * terasa saat ada penukaran barang: transaksi lama tetap menyimpan uang yang
 * dulu benar-benar masuk, sementara transaksi penggantinya hanya menyimpan
 * selisihnya. Kalau dihitung dari `total`, omzet hari lama akan ikut pindah
 * ke hari penukaran dan laporan hariannya jadi bohong (keputusan K33).
 *
 * Status yang ikut dihitung: `selesai` dan `ditukar`. Transaksi berstatus
 * `ditukar` uangnya memang sudah masuk, cuma barangnya yang berganti.
 */

const STATUS_BERUANG = `('selesai', 'ditukar')`;

function rentang(query = {}, kolom = 't.dikonfirmasi_pada') {
  const syarat = [`t.status in ${STATUS_BERUANG}`];
  const nilai = [];

  if (query.tanggal_dari) {
    nilai.push(query.tanggal_dari);
    syarat.push(`${kolom} >= $${nilai.length}::date`);
  }
  if (query.tanggal_sampai) {
    nilai.push(query.tanggal_sampai);
    syarat.push(`${kolom} < ($${nilai.length}::date + interval '1 day')`);
  }
  return { where: `where ${syarat.join(' and ')}`, nilai };
}

export async function ringkasan(query = {}) {
  const { where, nilai } = rentang(query);

  const { rows } = await kueri(
    `select
        count(*)::int                                            as jumlah_transaksi,
        coalesce(sum(t.uang_masuk), 0)::int                      as total_uang_masuk,
        coalesce(sum(t.diskon_rupiah), 0)::int                   as total_diskon,
        coalesce(sum(t.subtotal), 0)::int                        as total_sebelum_diskon,
        count(*) filter (where t.ditandai_stok_kurang)::int      as transaksi_stok_kurang,
        count(*) filter (where t.status = 'ditukar')::int        as jumlah_ditukar,
        count(*) filter (where t.ditukar_dari_id is not null)::int as jumlah_hasil_tukar,
        count(*) filter (where t.bill_id is not null)::int       as jumlah_dari_bill
      from transaksi t ${where}`,
    nilai
  );

  const ringkas = rows[0];
  ringkas.rata_rata_per_transaksi =
    ringkas.jumlah_transaksi > 0
      ? Math.round(ringkas.total_uang_masuk / ringkas.jumlah_transaksi)
      : 0;

  // Transaksi batal dihitung terpisah supaya ketahuan berapa yang gagal
  const syaratBatal = [`t.status = 'batal'`];
  const nilaiBatal = [];
  if (query.tanggal_dari) {
    nilaiBatal.push(query.tanggal_dari);
    syaratBatal.push(`t.dibuat_pada >= $${nilaiBatal.length}::date`);
  }
  if (query.tanggal_sampai) {
    nilaiBatal.push(query.tanggal_sampai);
    syaratBatal.push(`t.dibuat_pada < ($${nilaiBatal.length}::date + interval '1 day')`);
  }
  const { rows: batal } = await kueri(
    `select count(*)::int as jumlah_batal from transaksi t where ${syaratBatal.join(' and ')}`,
    nilaiBatal
  );
  ringkas.jumlah_batal = batal[0].jumlah_batal;

  return ringkas;
}

/** Perbandingan uang masuk hari per hari. */
export async function harian(query = {}) {
  const { where, nilai } = rentang(query);
  const { rows } = await kueri(
    `select
        (t.dikonfirmasi_pada at time zone 'Asia/Jakarta')::date as tanggal,
        count(*)::int                       as jumlah_transaksi,
        coalesce(sum(t.uang_masuk), 0)::int as total
       from transaksi t ${where}
      group by 1
      order by 1 asc`,
    nilai
  );
  return rows;
}

export async function perJam(query = {}) {
  const { where, nilai } = rentang(query);
  const { rows } = await kueri(
    `select
        extract(hour from t.dikonfirmasi_pada at time zone 'Asia/Jakarta')::int as jam,
        count(*)::int                       as jumlah_transaksi,
        coalesce(sum(t.uang_masuk), 0)::int as total
       from transaksi t ${where}
      group by 1
      order by 1 asc`,
    nilai
  );
  return rows;
}

export async function terlaris(query = {}) {
  const { where, nilai } = rentang(query);
  const batas = Math.min(Number(query.batas) || 10, 50);

  const { rows } = await kueri(
    `select i.nama_barang, i.jenis_barang,
            sum(i.jumlah)::int   as jumlah_terjual,
            sum(i.subtotal)::int as total_penjualan
       from transaksi_item i
       join transaksi t on t.id = i.transaksi_id
       ${where}
      group by i.nama_barang, i.jenis_barang
      order by jumlah_terjual desc
      limit $${nilai.length + 1}`,
    [...nilai, batas]
  );
  return rows;
}

export async function perKasir(query = {}) {
  const { where, nilai } = rentang(query);
  const { rows } = await kueri(
    `select t.nama_kasir,
            count(*)::int                          as jumlah_transaksi,
            coalesce(sum(t.uang_masuk), 0)::int    as total,
            coalesce(sum(t.diskon_rupiah), 0)::int as total_diskon
       from transaksi t ${where}
      group by t.nama_kasir
      order by total desc`,
    nilai
  );
  return rows;
}

/**
 * Nilai barang yang keluar BUKAN karena dijual: sample promosi, dimakan
 * karyawan, hadiah, rusak, tumpah, hilang (permintaan R5).
 *
 * Nilainya dihitung dari harga jual produk yang berlaku sekarang. Itu bukan
 * harga pokok, jadi angkanya adalah potensi pendapatan yang hilang, bukan
 * kerugian modal.
 */
export async function stokKeluarBukanJualan(query = {}) {
  const syarat = [`g.jenis = 'pengurangan_manual'`];
  const nilai = [];

  if (query.tanggal_dari) {
    nilai.push(query.tanggal_dari);
    syarat.push(`g.dibuat_pada >= $${nilai.length}::date`);
  }
  if (query.tanggal_sampai) {
    nilai.push(query.tanggal_sampai);
    syarat.push(`g.dibuat_pada < ($${nilai.length}::date + interval '1 day')`);
  }

  const { rows } = await kueri(
    `select g.alasan,
            sum(abs(g.jumlah))::int as jumlah_barang,
            sum(abs(g.jumlah) * coalesce(p.harga_diskon, p.harga))::int as nilai
       from pergerakan_stok g
       join produk p on p.id = g.produk_id
      where ${syarat.join(' and ')}
      group by g.alasan
      order by nilai desc`,
    nilai
  );

  const total = rows.reduce((t, r) => t + r.nilai, 0);
  const bukanRusak = rows
    .filter((r) => ALASAN_BUKAN_RUSAK.includes(r.alasan))
    .reduce((t, r) => t + r.nilai, 0);

  return {
    per_alasan: rows,
    total_nilai: total,
    nilai_sengaja_dikeluarkan: bukanRusak,
    nilai_kerusakan: total - bukanRusak,
  };
}

/**
 * Uang yang dikembalikan ke pembeli saat barang penggantinya lebih murah,
 * dipisah menurut sumber dananya. Yang ditalangi kasir perlu diganti
 * (keputusan K30).
 */
export async function pengembalianUang(query = {}) {
  const syarat = [];
  const nilai = [];

  if (query.tanggal_dari) {
    nilai.push(query.tanggal_dari);
    syarat.push(`r.dibuat_pada >= $${nilai.length}::date`);
  }
  if (query.tanggal_sampai) {
    nilai.push(query.tanggal_sampai);
    syarat.push(`r.dibuat_pada < ($${nilai.length}::date + interval '1 day')`);
  }
  const where = syarat.length ? `where ${syarat.join(' and ')}` : '';

  const { rows: ringkas } = await kueri(
    `select
        coalesce(sum(r.jumlah), 0)::int as total,
        coalesce(sum(r.jumlah) filter (where r.sumber_dana = 'kantor'), 0)::int as dari_kantor,
        coalesce(sum(r.jumlah) filter (where r.sumber_dana = 'kasir'), 0)::int  as ditalangi_kasir,
        coalesce(sum(r.jumlah) filter (where r.sumber_dana = 'kasir' and not r.sudah_diganti), 0)::int as belum_diganti,
        count(*)::int as jumlah_kejadian
       from pengembalian_uang r ${where}`,
    nilai
  );

  const { rows: perKasirTalang } = await kueri(
    `select r.nama_user,
            sum(r.jumlah)::int as total,
            sum(r.jumlah) filter (where not r.sudah_diganti)::int as belum_diganti,
            count(*)::int as jumlah_kejadian
       from pengembalian_uang r
       ${where ? where + " and r.sumber_dana = 'kasir'" : "where r.sumber_dana = 'kasir'"}
      group by r.nama_user
      order by belum_diganti desc nulls last`,
    nilai
  );

  return { ...ringkas[0], per_kasir: perKasirTalang };
}

/** Angka-angka penting untuk kepala halaman dashboard. */
export async function sorotan() {
  const { rows } = await kueri(
    `select
       (select count(*)::int from produk where diarsipkan_pada is null)   as jumlah_produk,
       (select count(*)::int from produk where diarsipkan_pada is null and dijual_satuan) as produk_dijual_satuan,
       (select count(*)::int from menu   where diarsipkan_pada is null)   as jumlah_menu,
       (select count(*)::int from produk where diarsipkan_pada is null and stok <= 0) as produk_habis,
       (select count(*)::int from transaksi
          where status = 'selesai' and status_struk = 'menunggu_kirim')   as struk_belum_terkirim,
       (select count(*)::int from kontak_whatsapp)                        as jumlah_kontak,
       (select count(*)::int from transaksi where status = 'menunggu_pembayaran') as belum_dibayar,
       (select count(*)::int from bill where status = 'terbuka')          as bill_terbuka,
       (select coalesce(sum(jumlah), 0)::int from pengembalian_uang
          where sumber_dana = 'kasir' and not sudah_diganti)              as talangan_belum_diganti`
  );
  return rows[0];
}
