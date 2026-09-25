import 'dotenv/config';
import { kueri } from '../../shared/db/pool.js';
import { tidakDitemukan } from '../../shared/middleware/error.js';
import { rupiah, halaman, polaNomor } from '../../shared/utils/bantu.js';

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
    `Lihat struk Anda: ${linkStruk(trx.kode_struk)}`,
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

  const syarat = [
    `status = 'selesai'`,
    `status_struk = 'menunggu_kirim'`,
    `nomor_wa is not null`,
  ];
  const nilai = [];

  // Pencarian menerima nama pembeli, nomor telepon, maupun nomor transaksi.
  // Nomor telepon dicocokkan dalam beberapa bentuk penulisan sekaligus,
  // supaya mengetik "0878" maupun "62878" sama-sama ketemu, walaupun baru
  // sepotong dan belum berupa nomor lengkap.
  if (query.cari) {
    const kata = String(query.cari).trim();
    nilai.push(`%${kata}%`);
    const posKata = nilai.length;

    const cocokNomor = polaNomor(kata).map((p) => {
      nilai.push(`%${p}%`);
      return `nomor_wa ilike $${nilai.length}`;
    });

    syarat.push(
      `(nama_pembeli ilike $${posKata}
        or nomor ilike $${posKata}
        ${cocokNomor.length ? 'or ' + cocokNomor.join(' or ') : ''})`
    );
  }

  const where = `where ${syarat.join(' and ')}`;

  const { rows } = await kueri(
    `select id, nomor, kode_struk, total, nama_pembeli, nomor_wa,
            nama_kasir, dikonfirmasi_pada
       from transaksi
       ${where}
      order by dikonfirmasi_pada desc
      limit $${nilai.length + 1} offset $${nilai.length + 2}`,
    [...nilai, perHalaman, lewati]
  );

  const { rows: hitung } = await kueri(
    `select count(*)::int as total from transaksi ${where}`,
    nilai
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
    const kata = String(query.cari).trim();
    nilai.push(`%${kata}%`);
    const posKata = nilai.length;

    // Nomor disimpan dalam bentuk 62..., sementara orang terbiasa mengetik
    // 08... Semua bentuk penulisannya dicocokkan sekaligus.
    const cocokNomor = polaNomor(kata).map((p) => {
      nilai.push(`%${p}%`);
      return `nomor ilike $${nilai.length}`;
    });

    syarat.push(
      `(nama ilike $${posKata}${cocokNomor.length ? ' or ' + cocokNomor.join(' or ') : ''})`
    );
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
