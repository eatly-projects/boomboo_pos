import { kueri } from '../../shared/db/pool.js';

/**
 * Semua angka di sini dihitung HANYA dari transaksi berstatus `selesai`.
 * Transaksi yang masih menunggu pembayaran atau sudah dibatalkan tidak
 * pernah ikut dihitung sebagai uang masuk.
 */

function rentang(query = {}) {
  const syarat = [`t.status = 'selesai'`];
  const nilai = [];

  if (query.tanggal_dari) {
    nilai.push(query.tanggal_dari);
    syarat.push(`t.dikonfirmasi_pada >= $${nilai.length}::date`);
  }
  if (query.tanggal_sampai) {
    nilai.push(query.tanggal_sampai);
    syarat.push(`t.dikonfirmasi_pada < ($${nilai.length}::date + interval '1 day')`);
  }
  return { where: `where ${syarat.join(' and ')}`, nilai };
}

export async function ringkasan(query = {}) {
  const { where, nilai } = rentang(query);

  const { rows } = await kueri(
    `select
        count(*)::int                                                   as jumlah_transaksi,
        coalesce(sum(t.total), 0)::int                                  as total_uang_masuk,
        coalesce(sum(t.total) filter (where t.metode_bayar = 'qris'), 0)::int  as uang_qris,
        coalesce(sum(t.total) filter (where t.metode_bayar = 'tunai'), 0)::int as uang_tunai,
        count(*) filter (where t.metode_bayar = 'qris')::int            as jumlah_qris,
        count(*) filter (where t.metode_bayar = 'tunai')::int           as jumlah_tunai,
        coalesce(sum(t.diskon_rupiah), 0)::int                          as total_diskon,
        coalesce(sum(t.subtotal), 0)::int                               as total_sebelum_diskon,
        count(*) filter (where t.ditandai_stok_kurang)::int             as transaksi_stok_kurang
      from transaksi t ${where}`,
    nilai
  );

  const ringkas = rows[0];
  ringkas.rata_rata_per_transaksi =
    ringkas.jumlah_transaksi > 0
      ? Math.round(ringkas.total_uang_masuk / ringkas.jumlah_transaksi)
      : 0;

  // Transaksi batal dihitung terpisah, supaya ketahuan berapa yang gagal
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

/** Perbandingan penjualan hari per hari. */
export async function harian(query = {}) {
  const { where, nilai } = rentang(query);
  const { rows } = await kueri(
    `select
        (t.dikonfirmasi_pada at time zone 'Asia/Jakarta')::date as tanggal,
        count(*)::int                                                    as jumlah_transaksi,
        coalesce(sum(t.total), 0)::int                                   as total,
        coalesce(sum(t.total) filter (where t.metode_bayar = 'qris'), 0)::int  as qris,
        coalesce(sum(t.total) filter (where t.metode_bayar = 'tunai'), 0)::int as tunai
       from transaksi t ${where}
      group by 1
      order by 1 asc`,
    nilai
  );
  return rows;
}

/** Penjualan per jam - berguna untuk tahu jam ramai di lokasi event. */
export async function perJam(query = {}) {
  const { where, nilai } = rentang(query);
  const { rows } = await kueri(
    `select
        extract(hour from t.dikonfirmasi_pada at time zone 'Asia/Jakarta')::int as jam,
        count(*)::int                  as jumlah_transaksi,
        coalesce(sum(t.total), 0)::int as total
       from transaksi t ${where}
      group by 1
      order by 1 asc`,
    nilai
  );
  return rows;
}

/** Barang terlaris, digabung antara Produk dan Menu. */
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

/** Penjualan per kasir. */
export async function perKasir(query = {}) {
  const { where, nilai } = rentang(query);
  const { rows } = await kueri(
    `select t.nama_kasir,
            count(*)::int                  as jumlah_transaksi,
            coalesce(sum(t.total), 0)::int as total,
            coalesce(sum(t.total) filter (where t.metode_bayar = 'qris'), 0)::int  as qris,
            coalesce(sum(t.total) filter (where t.metode_bayar = 'tunai'), 0)::int as tunai,
            coalesce(sum(t.diskon_rupiah), 0)::int as total_diskon
       from transaksi t ${where}
      group by t.nama_kasir
      order by total desc`,
    nilai
  );
  return rows;
}

/** Angka-angka penting untuk kepala halaman dashboard. */
export async function sorotan() {
  const { rows } = await kueri(
    `select
       (select count(*)::int from produk where diarsipkan_pada is null)   as jumlah_produk,
       (select count(*)::int from menu   where diarsipkan_pada is null)   as jumlah_menu,
       (select count(*)::int from produk where diarsipkan_pada is null and stok <= 0) as produk_habis,
       (select count(*)::int from transaksi
          where status = 'selesai' and status_struk = 'menunggu_kirim')   as struk_belum_terkirim,
       (select count(*)::int from kontak_whatsapp)                        as jumlah_kontak,
       (select count(*)::int from transaksi where status = 'menunggu_pembayaran') as belum_dibayar`
  );
  return rows[0];
}
