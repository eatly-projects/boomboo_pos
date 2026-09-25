import { kueri } from '../../shared/db/pool.js';
import { dalamTransaksi } from '../../shared/db/transaksi-db.js';
import { gerakkanStok } from '../../shared/stok/pergerakan.js';
import { catatLog } from '../../shared/utils/log.js';
import {
  kodeAcak,
  bakukanNomorWa,
  hargaDipakai,
  nomorTransaksiBerikutnya,
  halaman,
} from '../../shared/utils/bantu.js';
import { KesalahanAplikasi, tidakDitemukan } from '../../shared/middleware/error.js';

/* ------------------------------------------------------------------ */
/* Membuat transaksi (belum dibayar)                                   */
/* ------------------------------------------------------------------ */

/**
 * Kasir menekan "Lanjut ke Pembayaran".
 *
 * Transaksi dibuat dengan status `menunggu_pembayaran`. Stok BELUM berkurang
 * di sini - stok baru berkurang setelah pembayaran dikonfirmasi (keputusan K6).
 * Ketersediaan stok tetap diperiksa sekarang, supaya kasir tidak sampai ke
 * layar pembayaran untuk barang yang sudah habis.
 */
export async function buat({ item, diskon_jenis, diskon_nilai }, user) {
  if (!Array.isArray(item) || item.length === 0)
    throw new KesalahanAplikasi('Keranjang masih kosong.', 400);

  return dalamTransaksi(async (klien) => {
    const barisItem = [];
    let subtotal = 0;

    // Digabungkan dulu supaya satu produk yang dipilih dua kali tetap
    // diperiksa stoknya sebagai satu kesatuan.
    const totalPerBarang = new Map();
    for (const it of item) {
      const kunci = `${it.jenis_barang}:${it.barang_id}`;
      totalPerBarang.set(kunci, (totalPerBarang.get(kunci) || 0) + it.jumlah);
    }

    let urutan = 0;
    for (const [kunci, jumlah] of totalPerBarang) {
      const [jenis, id] = kunci.split(':');
      const tabel = jenis === 'produk' ? 'produk' : 'menu';

      const { rows } = await klien.query(
        `select * from ${tabel} where id = $1 and diarsipkan_pada is null`,
        [id]
      );
      const barang = rows[0];
      if (!barang)
        throw new KesalahanAplikasi(
          `Ada barang di keranjang yang sudah tidak tersedia. Silakan muat ulang layar kasir.`,
          400
        );

      if (jenis === 'produk' && barang.stok < jumlah)
        throw new KesalahanAplikasi(
          `Stok ${barang.nama} tidak cukup. Sisa ${barang.stok}, diminta ${jumlah}.`,
          400
        );

      // Semua nilai di bawah ini DIBEKUKAN - disalin apa adanya ke dalam
      // transaksi, supaya mengubah harga besok tidak mengubah struk hari ini.
      const dipakai = hargaDipakai(barang);
      const barisSubtotal = dipakai * jumlah;
      subtotal += barisSubtotal;

      barisItem.push({
        jenis_barang: jenis,
        barang_id: barang.id,
        nama_barang: barang.nama,
        harga_normal: barang.harga,
        harga_diskon: barang.harga_diskon,
        nama_diskon: barang.nama_diskon,
        harga_dipakai: dipakai,
        jumlah,
        subtotal: barisSubtotal,
        urutan: urutan++,
      });
    }

    // Diskon dari kasir: persentase ATAU nominal, tidak boleh dua-duanya.
    let diskonRupiah = 0;
    if (diskon_jenis && diskon_nilai != null && diskon_nilai > 0) {
      diskonRupiah =
        diskon_jenis === 'persen'
          ? Math.round((subtotal * diskon_nilai) / 100)
          : diskon_nilai;
      if (diskonRupiah > subtotal) diskonRupiah = subtotal; // total tidak boleh minus
    }
    const total = subtotal - diskonRupiah;

    const nomor = await nomorTransaksiBerikutnya(klien);

    const { rows: dibuat } = await klien.query(
      `insert into transaksi
         (nomor, kode_struk, status, subtotal, diskon_jenis, diskon_nilai,
          diskon_rupiah, total, kasir_id, nama_kasir)
       values ($1, $2, 'menunggu_pembayaran', $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        nomor,
        kodeAcak(24),
        subtotal,
        diskonRupiah > 0 ? diskon_jenis : null,
        diskonRupiah > 0 ? diskon_nilai : null,
        diskonRupiah,
        total,
        user.id,
        user.nama,
      ]
    );
    const transaksi = dibuat[0];

    for (const b of barisItem) {
      await klien.query(
        `insert into transaksi_item
           (transaksi_id, jenis_barang, barang_id, nama_barang, harga_normal,
            harga_diskon, nama_diskon, harga_dipakai, jumlah, subtotal, urutan)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          transaksi.id,
          b.jenis_barang,
          b.barang_id,
          b.nama_barang,
          b.harga_normal,
          b.harga_diskon,
          b.nama_diskon,
          b.harga_dipakai,
          b.jumlah,
          b.subtotal,
          b.urutan,
        ]
      );
    }

    // Diskon dari kasir selalu dicatat: siapa, berapa, di transaksi mana.
    if (diskonRupiah > 0) {
      await catatLog(
        {
          user,
          aksi: 'beri_diskon_transaksi',
          entitas: 'transaksi',
          entitasId: transaksi.id,
          namaEntitas: transaksi.nomor,
          detail: {
            jenis: diskon_jenis,
            nilai_diketik: diskon_nilai,
            potongan_rupiah: diskonRupiah,
            subtotal,
            total_akhir: total,
          },
        },
        klien
      );
    }

    return { ...transaksi, item: barisItem };
  });
}

/* ------------------------------------------------------------------ */
/* Konfirmasi pembayaran - di sinilah transaksi benar-benar jadi        */
/* ------------------------------------------------------------------ */

export async function konfirmasi(id, { metode_bayar, uang_diterima }, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from transaksi where id = $1 for update', [id]);
    const trx = rows[0];
    if (!trx) throw tidakDitemukan('Transaksi tidak ditemukan.');

    if (trx.status === 'selesai')
      throw new KesalahanAplikasi('Transaksi ini sudah dikonfirmasi sebelumnya.', 409);
    if (trx.status === 'batal')
      throw new KesalahanAplikasi('Transaksi ini sudah dibatalkan.', 409);

    let kembalian = null;
    if (metode_bayar === 'tunai') {
      if (uang_diterima == null)
        throw new KesalahanAplikasi('Jumlah uang yang diterima wajib diisi.', 400);
      if (uang_diterima < trx.total)
        throw new KesalahanAplikasi(
          `Uang yang diterima kurang. Total Rp ${trx.total.toLocaleString('id-ID')}.`,
          400
        );
      kembalian = uang_diterima - trx.total;
    }

    const { rows: item } = await klien.query(
      'select * from transaksi_item where transaksi_id = $1',
      [id]
    );

    // Stok berkurang SEKARANG, bukan saat barang masuk keranjang.
    //
    // `bolehMinus: true` sengaja dipakai di sini, dan HANYA di sini. Pada titik
    // ini uang pembeli sudah masuk. Kalau kebetulan kasir lain baru saja
    // mengambil sisa stok terakhir, menolak transaksi ini berarti menolak uang
    // yang sudah dibayar di depan orang banyak - itu pilihan terburuk.
    // Transaksinya diloloskan, lalu ditandai supaya ketahuan saat stok opname.
    let adaYangMinus = false;
    for (const b of item) {
      if (b.jenis_barang !== 'produk') continue; // Menu memang tidak punya stok
      const hasil = await gerakkanStok(klien, {
        produkId: b.barang_id,
        jenis: 'penjualan',
        jumlah: -b.jumlah,
        transaksiId: id,
        catatan: `Terjual lewat transaksi ${trx.nomor}`,
        user,
        bolehMinus: true,
      });
      if (hasil.jadi_minus) adaYangMinus = true;
    }

    const { rows: selesai } = await klien.query(
      `update transaksi
          set status = 'selesai',
              metode_bayar = $1,
              uang_diterima = $2,
              kembalian = $3,
              dikonfirmasi_oleh_id = $4,
              nama_pengonfirmasi = $5,
              dikonfirmasi_pada = now(),
              ditandai_stok_kurang = $6
        where id = $7
        returning *`,
      [
        metode_bayar,
        metode_bayar === 'tunai' ? uang_diterima : null,
        kembalian,
        user.id,
        user.nama,
        adaYangMinus,
        id,
      ]
    );

    await catatLog(
      {
        user,
        aksi: 'konfirmasi_pembayaran',
        entitas: 'transaksi',
        entitasId: id,
        namaEntitas: trx.nomor,
        detail: {
          metode_bayar,
          total: trx.total,
          uang_diterima: metode_bayar === 'tunai' ? uang_diterima : null,
          kembalian,
          stok_kurang: adaYangMinus,
        },
      },
      klien
    );

    return { ...selesai[0], item };
  });
}

/* ------------------------------------------------------------------ */
/* Pembatalan                                                          */
/* ------------------------------------------------------------------ */

export async function batal(id, { alasan }, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from transaksi where id = $1 for update', [id]);
    const trx = rows[0];
    if (!trx) throw tidakDitemukan('Transaksi tidak ditemukan.');
    if (trx.status === 'batal')
      throw new KesalahanAplikasi('Transaksi ini sudah dibatalkan.', 409);

    // Kalau transaksinya sudah selesai, stok dikembalikan lewat baris
    // pergerakan BARU berjenis `pembatalan` - bukan dengan menghapus baris
    // lama. Riwayatnya harus tetap utuh dan bisa dibaca.
    if (trx.status === 'selesai') {
      const { rows: item } = await klien.query(
        `select * from transaksi_item where transaksi_id = $1 and jenis_barang = 'produk'`,
        [id]
      );
      for (const b of item) {
        await gerakkanStok(klien, {
          produkId: b.barang_id,
          jenis: 'pembatalan',
          jumlah: b.jumlah,
          transaksiId: id,
          catatan: `Pengembalian stok dari pembatalan transaksi ${trx.nomor}`,
          user,
        });
      }
    }

    const { rows: dibatalkan } = await klien.query(
      `update transaksi
          set status = 'batal',
              dibatalkan_oleh_id = $1,
              nama_pembatal = $2,
              alasan_batal = $3,
              dibatalkan_pada = now()
        where id = $4
        returning *`,
      [user.id, user.nama, alasan || null, id]
    );

    await catatLog(
      {
        user,
        aksi: 'batal_transaksi',
        entitas: 'transaksi',
        entitasId: id,
        namaEntitas: trx.nomor,
        detail: {
          status_sebelumnya: trx.status,
          total: trx.total,
          alasan: alasan || null,
          stok_dikembalikan: trx.status === 'selesai',
        },
      },
      klien
    );

    return dibatalkan[0];
  });
}

/* ------------------------------------------------------------------ */
/* Data pembeli & struk WhatsApp                                       */
/* ------------------------------------------------------------------ */

export async function isiPembeli(id, { nama_pembeli, nomor_wa }, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from transaksi where id = $1', [id]);
    const trx = rows[0];
    if (!trx) throw tidakDitemukan('Transaksi tidak ditemukan.');
    if (trx.status !== 'selesai')
      throw new KesalahanAplikasi(
        'Data pembeli hanya bisa diisi setelah pembayaran dikonfirmasi.',
        400
      );

    const nomor = bakukanNomorWa(nomor_wa);
    if (nomor_wa && !nomor)
      throw new KesalahanAplikasi('Nomor WhatsApp belum benar. Contoh: 081234567890.', 400);

    const nama = nama_pembeli?.trim() || null;

    const { rows: diperbarui } = await klien.query(
      `update transaksi
          set nama_pembeli = $1, nomor_wa = $2,
              status_struk = case when $2::text is null then 'dilewati' else 'menunggu_kirim' end
        where id = $3
        returning *`,
      [nama, nomor, id]
    );

    // Daftar nomor disimpan sebagai aset pemasaran (keputusan K8).
    // Nomor yang sudah pernah ada diperbarui, bukan dibuat ganda.
    if (nomor) {
      await klien.query(
        `insert into kontak_whatsapp (nomor, nama, jumlah_transaksi, total_belanja)
         values ($1, $2, 1, $3)
         on conflict (nomor) do update
            set nama = coalesce(excluded.nama, kontak_whatsapp.nama),
                terakhir_pada = now(),
                jumlah_transaksi = kontak_whatsapp.jumlah_transaksi + 1,
                total_belanja = kontak_whatsapp.total_belanja + excluded.total_belanja`,
        [nomor, nama, trx.total]
      );
    }

    return diperbarui[0];
  });
}

export async function lewatiStruk(id) {
  const { rows } = await kueri(
    `update transaksi set status_struk = 'dilewati'
      where id = $1 and status = 'selesai'
      returning *`,
    [id]
  );
  if (!rows[0]) throw tidakDitemukan('Transaksi tidak ditemukan atau belum selesai.');
  return rows[0];
}

/* ------------------------------------------------------------------ */
/* Pembacaan                                                           */
/* ------------------------------------------------------------------ */

export async function ambil(id) {
  const { rows } = await kueri('select * from transaksi where id = $1', [id]);
  if (!rows[0]) throw tidakDitemukan('Transaksi tidak ditemukan.');
  const { rows: item } = await kueri(
    'select * from transaksi_item where transaksi_id = $1 order by urutan asc',
    [id]
  );
  return { ...rows[0], item };
}

export async function daftar(query = {}) {
  const { perHalaman, halamanKe, lewati } = halaman(query);
  const syarat = [];
  const nilai = [];

  const tambahSyarat = (teks, isi) => {
    nilai.push(isi);
    syarat.push(teks.replace('$?', `$${nilai.length}`));
  };

  if (query.status) tambahSyarat('t.status = $?', query.status);
  if (query.metode_bayar) tambahSyarat('t.metode_bayar = $?', query.metode_bayar);
  if (query.kasir_id) tambahSyarat('t.kasir_id = $?', query.kasir_id);
  if (query.cari) tambahSyarat('t.nomor ilike $?', `%${query.cari}%`);
  if (query.tanggal_dari) tambahSyarat('t.dibuat_pada >= $?::date', query.tanggal_dari);
  if (query.tanggal_sampai)
    tambahSyarat("t.dibuat_pada < ($?::date + interval '1 day')", query.tanggal_sampai);

  const where = syarat.length ? `where ${syarat.join(' and ')}` : '';

  const { rows } = await kueri(
    `select t.*,
            (select count(*)::int from transaksi_item i where i.transaksi_id = t.id) as jumlah_baris
       from transaksi t
       ${where}
      order by t.dibuat_pada desc
      limit $${nilai.length + 1} offset $${nilai.length + 2}`,
    [...nilai, perHalaman, lewati]
  );

  const { rows: hitung } = await kueri(
    `select count(*)::int as total from transaksi t ${where}`,
    nilai
  );

  return {
    daftar: rows,
    halaman: { halaman: halamanKe, per_halaman: perHalaman, total: hitung[0].total },
  };
}
