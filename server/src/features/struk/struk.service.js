import 'dotenv/config';
import { kueri } from '../../shared/db/pool.js';
import { tidakDitemukan } from '../../shared/middleware/error.js';
import { rupiah, halaman } from '../../shared/utils/bantu.js';

const alamatAplikasi = () => (process.env.APP_URL || 'http://localhost:5180').replace(/\/$/, '');

export const linkStruk = (kode) => `${alamatAplikasi()}/struk/${kode}`;

/**
 * Menyusun isi pesan WhatsApp.
 *
 * Nama pembeli boleh kosong, jadi sapaannya harus tetap enak dibaca.
 * Jangan sampai keluar pesan seperti "Halo ,".
 */
export function susunPesanWa(trx) {
  const sapaan = trx.nama_pembeli?.trim() ? `Halo ${trx.nama_pembeli.trim()}!` : 'Halo Kak!';
  return [
    sapaan,
    'Terima kasih sudah belanja di Boomboo.',
    '',
    `Total belanja: ${rupiah(trx.total)}`,
    `Struk: ${linkStruk(trx.kode_struk)}`,
    '',
    'Gurih, nagih. Sampai ketemu lagi!',
  ].join('\n');
}

/** Data struk untuk halaman publik. Tidak perlu masuk. */
export async function publik(kode) {
  const { rows } = await kueri(
    `select id, nomor, kode_struk, status, metode_bayar, subtotal,
            diskon_jenis, diskon_nilai, diskon_rupiah, total,
            uang_diterima, kembalian, nama_pembeli, nama_kasir,
            dibuat_pada, dikonfirmasi_pada
       from transaksi
      where kode_struk = $1 and status = 'selesai'`,
    [kode]
  );
  const trx = rows[0];
  if (!trx) throw tidakDitemukan('Struk tidak ditemukan atau sudah tidak berlaku.');

  const { rows: item } = await kueri(
    `select nama_barang, jenis_barang, harga_normal, harga_diskon, nama_diskon,
            harga_dipakai, jumlah, subtotal
       from transaksi_item
      where transaksi_id = $1
      order by urutan asc`,
    [trx.id]
  );

  const { rows: atur } = await kueri(
    `select kunci, nilai from pengaturan where kunci in ('nama_toko','teks_struk_bawah')`
  );
  const pengaturan = Object.fromEntries(atur.map((a) => [a.kunci, a.nilai]));

  // id sengaja tidak ikut dikirim ke halaman publik
  const { id, ...aman } = trx;
  return { ...aman, item, pengaturan };
}

/** Daftar struk yang sudah punya nomor WhatsApp tapi belum dikirim. */
export async function antrian(query = {}) {
  const { perHalaman, halamanKe, lewati } = halaman({ per_halaman: 50, ...query });

  const { rows } = await kueri(
    `select id, nomor, kode_struk, total, nama_pembeli, nomor_wa,
            nama_kasir, dikonfirmasi_pada
       from transaksi
      where status = 'selesai'
        and status_struk = 'menunggu_kirim'
        and nomor_wa is not null
      order by dikonfirmasi_pada asc
      limit $1 offset $2`,
    [perHalaman, lewati]
  );

  const { rows: hitung } = await kueri(
    `select count(*)::int as total from transaksi
      where status = 'selesai' and status_struk = 'menunggu_kirim' and nomor_wa is not null`
  );

  return {
    daftar: rows.map((t) => ({
      ...t,
      pesan: susunPesanWa(t),
      link_struk: linkStruk(t.kode_struk),
      // Link ini yang dibuka petugas. WhatsApp terbuka dengan teks sudah terisi,
      // petugas tinggal menekan tombol kirim.
      link_whatsapp: `https://wa.me/${t.nomor_wa}?text=${encodeURIComponent(susunPesanWa(t))}`,
    })),
    halaman: { halaman: halamanKe, per_halaman: perHalaman, total: hitung[0].total },
  };
}

export async function tandaiTerkirim(id) {
  const { rows } = await kueri(
    `update transaksi set status_struk = 'terkirim'
      where id = $1 and status = 'selesai'
      returning id, nomor, status_struk`,
    [id]
  );
  if (!rows[0]) throw tidakDitemukan('Transaksi tidak ditemukan.');
  return rows[0];
}

/** Daftar nomor WhatsApp yang pernah dihubungi - aset pemasaran. */
export async function kontak(query = {}) {
  const { perHalaman, halamanKe, lewati } = halaman(query);
  const syarat = [];
  const nilai = [];

  if (query.cari) {
    nilai.push(`%${query.cari}%`);
    syarat.push(`(nomor ilike $${nilai.length} or nama ilike $${nilai.length})`);
  }
  const where = syarat.length ? `where ${syarat.join(' and ')}` : '';

  const { rows } = await kueri(
    `select * from kontak_whatsapp ${where}
      order by terakhir_pada desc
      limit $${nilai.length + 1} offset $${nilai.length + 2}`,
    [...nilai, perHalaman, lewati]
  );
  const { rows: hitung } = await kueri(
    `select count(*)::int as total from kontak_whatsapp ${where}`,
    nilai
  );

  return {
    daftar: rows,
    halaman: { halaman: halamanKe, per_halaman: perHalaman, total: hitung[0].total },
  };
}
