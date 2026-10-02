import { kueri } from '../../shared/db/pool.js';
import { dalamTransaksi } from '../../shared/db/transaksi-db.js';
import { periksaKetersediaan, gerakkanStokKeranjang } from '../../shared/stok/penjualan.js';
import { catatLog } from '../../shared/utils/log.js';
import {
  kodeAcak,
  bakukanNomorWa,
  hargaDipakai,
  polaNomor,
  nomorTransaksiBerikutnya,
  halaman,
} from '../../shared/utils/bantu.js';
import { KesalahanAplikasi, tidakDitemukan } from '../../shared/middleware/error.js';

/**
 * Open Bill: tagihan yang terus berjalan sampai kasir menutupnya.
 *
 * Bedanya dengan kasir biasa ada satu dan itu penting: di sini STOK BERKURANG
 * SAAT BARANG DIINPUT, bukan saat dibayar. Alasannya barangnya memang sudah
 * diserahkan ke pembeli sejak saat itu.
 *
 * Konsekuensinya, bill yang ditinggal pergi tanpa dibayar akan menyandera
 * stok sampai ada yang membatalkannya. Karena itu tombol batalkan wajib ada,
 * dan daftar bill menampilkan sudah berapa lama tiap bill terbuka.
 */

async function nomorBillBerikutnya(klien) {
  const { rows } = await klien.query(
    `insert into urutan_nomor_bill (tanggal, terakhir)
     values (current_date, 1)
     on conflict (tanggal) do update set terakhir = urutan_nomor_bill.terakhir + 1
     returning tanggal, terakhir`
  );
  const { tanggal, terakhir } = rows[0];
  const t = new Date(tanggal);
  const tgl =
    t.getFullYear().toString() +
    String(t.getMonth() + 1).padStart(2, '0') +
    String(t.getDate()).padStart(2, '0');
  return `BILL-${tgl}-${String(terakhir).padStart(4, '0')}`;
}

async function isiBill(bill) {
  const { rows: item } = await kueri(
    'select * from bill_item where bill_id = $1 order by dibuat_pada asc',
    [bill.id]
  );
  const subtotal = item.reduce((t, i) => t + i.subtotal, 0);
  return {
    ...bill,
    item,
    subtotal,
    jumlah_barang: item.reduce((t, i) => t + i.jumlah, 0),
  };
}

/* ------------------------------------------------------------------ */

export async function buka({ nama_pembeli, nomor_wa, penanda }, user) {
  const nomor = bakukanNomorWa(nomor_wa);
  if (nomor_wa && !nomor)
    throw new KesalahanAplikasi('Nomor WhatsApp belum benar. Contoh: 081234567890.', 400);

  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query(
      `insert into bill (nomor, nama_pembeli, nomor_wa, penanda, dibuka_oleh_id, nama_pembuka)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [
        await nomorBillBerikutnya(klien),
        nama_pembeli.trim(),
        nomor,
        penanda?.trim() || null,
        user.id,
        user.nama,
      ]
    );

    await catatLog(
      {
        user,
        aksi: 'buka_bill',
        entitas: 'bill',
        entitasId: rows[0].id,
        namaEntitas: rows[0].nomor,
        detail: { nama_pembeli: rows[0].nama_pembeli, penanda: rows[0].penanda },
      },
      klien
    );

    return { ...rows[0], item: [], subtotal: 0, jumlah_barang: 0 };
  });
}

export async function daftar(query = {}) {
  const { perHalaman, halamanKe, lewati } = halaman({ per_halaman: 50, ...query });
  const syarat = [];
  const nilai = [];

  syarat.push(query.status ? 'b.status = $1' : `b.status = 'terbuka'`);
  if (query.status) nilai.push(query.status);

  if (query.cari) {
    const kata = String(query.cari).trim();
    nilai.push(`%${kata}%`);
    const posKata = nilai.length;
    const cocokNomor = polaNomor(kata).map((p) => {
      nilai.push(`%${p}%`);
      return `b.nomor_wa ilike $${nilai.length}`;
    });
    syarat.push(
      `(b.nama_pembeli ilike $${posKata}
        or b.nomor ilike $${posKata}
        or b.penanda ilike $${posKata}
        ${cocokNomor.length ? 'or ' + cocokNomor.join(' or ') : ''})`
    );
  }

  const where = `where ${syarat.join(' and ')}`;

  const { rows } = await kueri(
    `select b.*,
            coalesce(i.jumlah_baris, 0) as jumlah_baris,
            coalesce(i.jumlah_barang, 0) as jumlah_barang,
            coalesce(i.subtotal, 0) as subtotal,
            extract(epoch from (now() - b.dibuka_pada))::int as detik_terbuka
       from bill b
       left join (
         select bill_id,
                count(*)::int as jumlah_baris,
                sum(jumlah)::int as jumlah_barang,
                sum(subtotal)::int as subtotal
           from bill_item group by bill_id
       ) i on i.bill_id = b.id
       ${where}
      order by b.dibuka_pada desc
      limit $${nilai.length + 1} offset $${nilai.length + 2}`,
    [...nilai, perHalaman, lewati]
  );

  const { rows: hitung } = await kueri(
    `select count(*)::int as total from bill b ${where}`,
    nilai
  );

  return {
    daftar: rows,
    halaman: { halaman: halamanKe, per_halaman: perHalaman, total: hitung[0].total },
  };
}

export async function ambil(id) {
  const { rows } = await kueri(
    `select b.*, t.nomor as nomor_transaksi, t.kode_struk
       from bill b
       left join transaksi t on t.id = b.transaksi_id
      where b.id = $1`,
    [id]
  );
  if (!rows[0]) throw tidakDitemukan('Bill tidak ditemukan.');
  return isiBill(rows[0]);
}

/* ------------------------------------------------------------------ */
/* Menambah dan mencabut barang                                        */
/* ------------------------------------------------------------------ */

export async function tambahItem(id, { jenis_barang, barang_id, jumlah }, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from bill where id = $1 for update', [id]);
    const bill = rows[0];
    if (!bill) throw tidakDitemukan('Bill tidak ditemukan.');
    if (bill.status !== 'terbuka')
      throw new KesalahanAplikasi('Bill ini sudah ditutup, barangnya tidak bisa ditambah lagi.', 409);

    const tabel = jenis_barang === 'produk' ? 'produk' : 'menu';
    const { rows: brg } = await klien.query(
      `select * from ${tabel} where id = $1 and diarsipkan_pada is null`,
      [barang_id]
    );
    const barang = brg[0];
    if (!barang) throw tidakDitemukan('Barang tidak ditemukan atau sudah diarsipkan.');
    if (jenis_barang === 'produk' && barang.dijual_satuan === false)
      throw new KesalahanAplikasi(
        `${barang.nama} tidak dijual satuan, hanya dipakai sebagai penyusun menu.`,
        400
      );

    const dipakai = hargaDipakai(barang);
    const baris = [
      {
        jenis_barang,
        barang_id,
        nama_barang: barang.nama,
        harga_normal: barang.harga,
        harga_diskon: barang.harga_diskon,
        nama_diskon: barang.nama_diskon,
        harga_dipakai: dipakai,
        jumlah,
        subtotal: dipakai * jumlah,
      },
    ];

    // Stok diperiksa dan langsung dipotong di sini. Barangnya memang sudah
    // berpindah ke pembeli walaupun tagihannya belum dibayar.
    await periksaKetersediaan(klien, baris);
    await gerakkanStokKeranjang(klien, {
      item: baris,
      jenis: 'bill_keluar',
      arah: -1,
      billId: id,
      catatan: `Masuk ke ${bill.nomor} atas nama ${bill.nama_pembeli}`,
      user,
    });

    const b = baris[0];
    const { rows: disimpan } = await klien.query(
      `insert into bill_item
         (bill_id, jenis_barang, barang_id, nama_barang, harga_normal, harga_diskon,
          nama_diskon, harga_dipakai, jumlah, subtotal, ditambah_oleh_id, nama_penambah)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *`,
      [
        id,
        b.jenis_barang,
        b.barang_id,
        b.nama_barang,
        b.harga_normal,
        b.harga_diskon,
        b.nama_diskon,
        b.harga_dipakai,
        b.jumlah,
        b.subtotal,
        user.id,
        user.nama,
      ]
    );

    await catatLog(
      {
        user,
        aksi: 'tambah_barang_bill',
        entitas: 'bill',
        entitasId: id,
        namaEntitas: bill.nomor,
        detail: { barang: b.nama_barang, jumlah: b.jumlah, subtotal: b.subtotal },
      },
      klien
    );

    return disimpan[0];
  });
}

/**
 * Mengubah jumlah satu baris yang sudah ada di bill, selama bill masih terbuka.
 *
 * Pembeli sering berubah pikiran sebelum bayar: tambah satu, kurangi satu,
 * atau tukar dengan barang lain. Stok harus ikut bergerak saat itu juga,
 * karena barangnya memang sudah berpindah tangan walaupun belum dibayar.
 *
 * Harganya TIDAK dihitung ulang. Harga dibekukan saat barang pertama kali
 * masuk bill, jadi kalau harga produknya diubah di tengah event, tagihan
 * yang sudah berjalan tidak ikut berubah.
 */
export async function ubahJumlahItem(id, itemId, { jumlah }, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from bill where id = $1 for update', [id]);
    const bill = rows[0];
    if (!bill) throw tidakDitemukan('Bill tidak ditemukan.');
    if (bill.status !== 'terbuka')
      throw new KesalahanAplikasi('Bill ini sudah ditutup, isinya tidak bisa diubah lagi.', 409);

    const { rows: baris } = await klien.query(
      'select * from bill_item where id = $1 and bill_id = $2 for update',
      [itemId, id]
    );
    const item = baris[0];
    if (!item) throw tidakDitemukan('Barang itu tidak ada di bill ini.');

    const selisih = jumlah - item.jumlah;

    if (selisih > 0) {
      // Nambah: periksa dulu stoknya cukup atau tidak, baru dipotong
      const tambahan = [{ ...item, jumlah: selisih }];
      await periksaKetersediaan(klien, tambahan);
      await gerakkanStokKeranjang(klien, {
        item: tambahan,
        jenis: 'bill_keluar',
        arah: -1,
        billId: id,
        catatan: `Ditambah di ${bill.nomor}, jadi ${jumlah}`,
        user,
      });
    } else if (selisih < 0) {
      // Berkurang: stok kembali lewat baris pergerakan baru, bukan dihapus
      await gerakkanStokKeranjang(klien, {
        item: [{ ...item, jumlah: -selisih }],
        jenis: 'bill_kembali',
        arah: 1,
        billId: id,
        catatan: `Dikurangi di ${bill.nomor}, jadi ${jumlah}`,
        user,
      });
    }

    const { rows: disimpan } = await klien.query(
      `update bill_item
          set jumlah = $1, subtotal = harga_dipakai * $1
        where id = $2
        returning *`,
      [jumlah, itemId]
    );

    if (selisih !== 0) {
      await catatLog(
        {
          user,
          aksi: 'ubah_jumlah_barang_bill',
          entitas: 'bill',
          entitasId: id,
          namaEntitas: bill.nomor,
          detail: {
            barang: item.nama_barang,
            jumlah_sebelum: item.jumlah,
            jumlah_sesudah: jumlah,
            selisih,
          },
        },
        klien
      );
    }

    return disimpan[0];
  });
}

export async function hapusItem(id, itemId, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from bill where id = $1 for update', [id]);
    const bill = rows[0];
    if (!bill) throw tidakDitemukan('Bill tidak ditemukan.');
    if (bill.status !== 'terbuka')
      throw new KesalahanAplikasi('Bill ini sudah ditutup, isinya tidak bisa diubah lagi.', 409);

    const { rows: baris } = await klien.query(
      'select * from bill_item where id = $1 and bill_id = $2',
      [itemId, id]
    );
    const item = baris[0];
    if (!item) throw tidakDitemukan('Barang itu tidak ada di bill ini.');

    // Stok dikembalikan lewat baris pergerakan baru, riwayatnya tetap utuh
    await gerakkanStokKeranjang(klien, {
      item: [item],
      jenis: 'bill_kembali',
      arah: 1,
      billId: id,
      catatan: `Dicabut dari ${bill.nomor}`,
      user,
    });

    await klien.query('delete from bill_item where id = $1', [itemId]);

    await catatLog(
      {
        user,
        aksi: 'hapus_barang_bill',
        entitas: 'bill',
        entitasId: id,
        namaEntitas: bill.nomor,
        detail: { barang: item.nama_barang, jumlah: item.jumlah },
      },
      klien
    );

    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Menutup dan membatalkan                                             */
/* ------------------------------------------------------------------ */

/**
 * Menutup bill berarti membuat transaksi dari isinya. Transaksinya langsung
 * berstatus menunggu pembayaran, lalu kasir meneruskannya ke layar QRIS
 * seperti penjualan biasa.
 *
 * Stok TIDAK dipotong lagi di sini - sudah dipotong satu per satu saat
 * barangnya dimasukkan ke bill.
 */
export async function tutup(id, { diskon_jenis, diskon_nilai }, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from bill where id = $1 for update', [id]);
    const bill = rows[0];
    if (!bill) throw tidakDitemukan('Bill tidak ditemukan.');
    if (bill.status !== 'terbuka')
      throw new KesalahanAplikasi('Bill ini sudah tidak terbuka.', 409);

    const { rows: item } = await klien.query(
      'select * from bill_item where bill_id = $1 order by dibuat_pada asc',
      [id]
    );
    if (item.length === 0)
      throw new KesalahanAplikasi(
        'Bill ini masih kosong. Kalau pembeli batal, pakai tombol Batalkan bill.',
        400
      );

    const subtotal = item.reduce((t, i) => t + i.subtotal, 0);
    let diskonRupiah = 0;
    if (diskon_jenis && diskon_nilai > 0) {
      diskonRupiah =
        diskon_jenis === 'persen' ? Math.round((subtotal * diskon_nilai) / 100) : diskon_nilai;
      diskonRupiah = Math.min(diskonRupiah, subtotal);
    }
    const total = subtotal - diskonRupiah;

    const { rows: dibuat } = await klien.query(
      `insert into transaksi
         (nomor, kode_struk, status, subtotal, diskon_jenis, diskon_nilai, diskon_rupiah,
          total, kasir_id, nama_kasir, bill_id, nama_pembeli, nomor_wa, status_struk)
       values ($1, $2, 'menunggu_pembayaran', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               case when $12::text is null then 'belum_diisi' else 'menunggu_kirim' end)
       returning *`,
      [
        await nomorTransaksiBerikutnya(klien),
        kodeAcak(24),
        subtotal,
        diskonRupiah > 0 ? diskon_jenis : null,
        diskonRupiah > 0 ? diskon_nilai : null,
        diskonRupiah,
        total,
        user.id,
        user.nama,
        id,
        bill.nama_pembeli,
        bill.nomor_wa,
      ]
    );
    const transaksi = dibuat[0];

    let urutan = 0;
    for (const i of item) {
      await klien.query(
        `insert into transaksi_item
           (transaksi_id, jenis_barang, barang_id, nama_barang, harga_normal,
            harga_diskon, nama_diskon, harga_dipakai, jumlah, subtotal, urutan)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          transaksi.id,
          i.jenis_barang,
          i.barang_id,
          i.nama_barang,
          i.harga_normal,
          i.harga_diskon,
          i.nama_diskon,
          i.harga_dipakai,
          i.jumlah,
          i.subtotal,
          urutan++,
        ]
      );
    }

    // Nomor yang sudah diisi sejak bill dibuka langsung masuk daftar kontak,
    // jadi kasir tidak perlu menanyakannya lagi saat pembayaran.
    if (bill.nomor_wa) {
      await klien.query(
        `insert into kontak_whatsapp (nomor, nama, jumlah_transaksi, total_belanja)
         values ($1, $2, 1, $3)
         on conflict (nomor) do update
            set nama = coalesce(excluded.nama, kontak_whatsapp.nama),
                terakhir_pada = now(),
                jumlah_transaksi = kontak_whatsapp.jumlah_transaksi + 1,
                total_belanja = kontak_whatsapp.total_belanja + excluded.total_belanja`,
        [bill.nomor_wa, bill.nama_pembeli, total]
      );
    }

    // Pergerakan stok milik bill ditempelkan ke transaksinya, supaya kartu
    // stok tetap bisa ditelusuri dari nomor transaksi.
    await klien.query(
      'update pergerakan_stok set transaksi_id = $1 where bill_id = $2 and transaksi_id is null',
      [transaksi.id, id]
    );

    await klien.query(
      `update bill
          set status = 'selesai', transaksi_id = $1,
              ditutup_oleh_id = $2, nama_penutup = $3, ditutup_pada = now()
        where id = $4`,
      [transaksi.id, user.id, user.nama, id]
    );

    await catatLog(
      {
        user,
        aksi: 'tutup_bill',
        entitas: 'bill',
        entitasId: id,
        namaEntitas: bill.nomor,
        detail: {
          nomor_transaksi: transaksi.nomor,
          jumlah_baris: item.length,
          subtotal,
          diskon: diskonRupiah,
          total,
        },
      },
      klien
    );

    return { ...transaksi, item, bill_nomor: bill.nomor };
  });
}

export async function batal(id, { alasan }, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from bill where id = $1 for update', [id]);
    const bill = rows[0];
    if (!bill) throw tidakDitemukan('Bill tidak ditemukan.');
    if (bill.status !== 'terbuka')
      throw new KesalahanAplikasi('Bill ini sudah tidak terbuka.', 409);

    const { rows: item } = await klien.query('select * from bill_item where bill_id = $1', [id]);

    if (item.length) {
      await gerakkanStokKeranjang(klien, {
        item,
        jenis: 'bill_kembali',
        arah: 1,
        billId: id,
        catatan: `Seluruh isi ${bill.nomor} dikembalikan karena bill dibatalkan`,
        user,
      });
    }

    const { rows: dibatalkan } = await klien.query(
      `update bill
          set status = 'batal', dibatalkan_oleh_id = $1, nama_pembatal = $2,
              alasan_batal = $3, dibatalkan_pada = now()
        where id = $4
        returning *`,
      [user.id, user.nama, alasan || null, id]
    );

    await catatLog(
      {
        user,
        aksi: 'batal_bill',
        entitas: 'bill',
        entitasId: id,
        namaEntitas: bill.nomor,
        detail: {
          alasan: alasan || null,
          jumlah_baris: item.length,
          stok_dikembalikan: item.length > 0,
        },
      },
      klien
    );

    return dibatalkan[0];
  });
}

/** Angka ringkas untuk kepala halaman Open Bill. */
export async function sorotan() {
  const { rows } = await kueri(
    `select
       count(*) filter (where status = 'terbuka')::int as bill_terbuka,
       coalesce(sum(
         case when status = 'terbuka'
           then (select coalesce(sum(subtotal),0) from bill_item i where i.bill_id = b.id)
           else 0 end
       ), 0)::int as nilai_tertahan,
       (select count(*)::int from bill
         where status = 'terbuka' and dibuka_pada < now() - interval '2 hours') as terbuka_lama
     from bill b`
  );
  return rows[0];
}
