import { kueri } from '../../shared/db/pool.js';
import { dalamTransaksi } from '../../shared/db/transaksi-db.js';
import { periksaKetersediaan, gerakkanStokKeranjang } from '../../shared/stok/penjualan.js';
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
/* Alat bantu bersama                                                  */
/* ------------------------------------------------------------------ */

/** Mengambil barang dari katalog dan membekukan harganya. */
async function bekukanBarang(klien, daftarItem) {
  const baris = [];
  let urutan = 0;

  // Barang yang sama dipilih dua kali digabung dulu, supaya pemeriksaan
  // stoknya benar dan strukinya tidak punya baris kembar.
  const gabungan = new Map();
  for (const it of daftarItem) {
    const kunci = `${it.jenis_barang}:${it.barang_id}`;
    gabungan.set(kunci, (gabungan.get(kunci) || 0) + it.jumlah);
  }

  for (const [kunci, jumlah] of gabungan) {
    const [jenis, id] = kunci.split(':');
    const tabel = jenis === 'produk' ? 'produk' : 'menu';

    const { rows } = await klien.query(
      `select * from ${tabel} where id = $1 and diarsipkan_pada is null`,
      [id]
    );
    const barang = rows[0];
    if (!barang)
      throw new KesalahanAplikasi(
        'Ada barang di keranjang yang sudah tidak tersedia. Silakan muat ulang layar kasir.',
        400
      );
    if (jenis === 'produk' && barang.dijual_satuan === false)
      throw new KesalahanAplikasi(
        `${barang.nama} tidak dijual satuan, hanya dipakai sebagai penyusun menu.`,
        400
      );

    const dipakai = hargaDipakai(barang);
    baris.push({
      jenis_barang: jenis,
      barang_id: barang.id,
      nama_barang: barang.nama,
      harga_normal: barang.harga,
      harga_diskon: barang.harga_diskon,
      nama_diskon: barang.nama_diskon,
      harga_dipakai: dipakai,
      jumlah,
      subtotal: dipakai * jumlah,
      urutan: urutan++,
    });
  }

  return baris;
}

/** Menghitung potongan diskon kasir. Total tidak pernah boleh di bawah nol. */
function hitungDiskon(subtotal, jenis, nilai) {
  if (!jenis || nilai == null || nilai <= 0) return 0;
  const potongan = jenis === 'persen' ? Math.round((subtotal * nilai) / 100) : nilai;
  return Math.min(potongan, subtotal);
}

async function simpanItem(klien, transaksiId, baris) {
  for (const b of baris) {
    await klien.query(
      `insert into transaksi_item
         (transaksi_id, jenis_barang, barang_id, nama_barang, harga_normal,
          harga_diskon, nama_diskon, harga_dipakai, jumlah, subtotal, urutan)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        transaksiId,
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
}

/* ------------------------------------------------------------------ */
/* Membuat transaksi (belum dibayar)                                   */
/* ------------------------------------------------------------------ */

export async function buat({ item, diskon_jenis, diskon_nilai }, user) {
  if (!Array.isArray(item) || item.length === 0)
    throw new KesalahanAplikasi('Keranjang masih kosong.', 400);

  return dalamTransaksi(async (klien) => {
    const baris = await bekukanBarang(klien, item);

    // Pemeriksaan stok sudah memperhitungkan penyusun menu (R6.2)
    await periksaKetersediaan(klien, baris);

    const subtotal = baris.reduce((t, b) => t + b.subtotal, 0);
    const diskonRupiah = hitungDiskon(subtotal, diskon_jenis, diskon_nilai);
    const total = subtotal - diskonRupiah;
    const nomor = await nomorTransaksiBerikutnya(klien);

    const { rows } = await klien.query(
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
    const transaksi = rows[0];
    await simpanItem(klien, transaksi.id, baris);

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

    return { ...transaksi, item: baris };
  });
}

/* ------------------------------------------------------------------ */
/* Konfirmasi pembayaran                                               */
/* ------------------------------------------------------------------ */

export async function konfirmasi(id, _isian, user) {
  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from transaksi where id = $1 for update', [id]);
    const trx = rows[0];
    if (!trx) throw tidakDitemukan('Transaksi tidak ditemukan.');
    if (trx.status === 'selesai')
      throw new KesalahanAplikasi('Transaksi ini sudah dikonfirmasi sebelumnya.', 409);
    if (trx.status !== 'menunggu_pembayaran')
      throw new KesalahanAplikasi('Transaksi ini sudah tidak bisa dikonfirmasi.', 409);

    const { rows: item } = await klien.query(
      'select * from transaksi_item where transaksi_id = $1',
      [id]
    );

    // Transaksi yang berasal dari Open Bill stoknya SUDAH dipotong satu per
    // satu saat barangnya dimasukkan ke bill. Kalau dipotong lagi di sini,
    // stoknya berkurang dua kali.
    let adaYangMinus = false;
    if (!trx.bill_id) {
      // Stok berkurang SEKARANG, bukan saat barang masuk keranjang.
      // `bolehMinus` dipakai di sini dan hanya di sini: pada titik ini uang
      // pembeli sudah masuk, dan menolak transaksi yang sudah dibayar di depan
      // orang banyak adalah pilihan terburuk.
      ({ adaYangMinus } = await gerakkanStokKeranjang(klien, {
        item,
        jenis: 'penjualan',
        arah: -1,
        transaksiId: id,
        catatan: `Terjual lewat transaksi ${trx.nomor}`,
        user,
        bolehMinus: true,
      }));
    }

    const { rows: selesai } = await klien.query(
      `update transaksi
          set status = 'selesai',
              metode_bayar = 'qris',
              uang_masuk = total,
              dikonfirmasi_oleh_id = $1,
              nama_pengonfirmasi = $2,
              dikonfirmasi_pada = now(),
              ditandai_stok_kurang = $3
        where id = $4
        returning *`,
      [user.id, user.nama, adaYangMinus, id]
    );

    await catatLog(
      {
        user,
        aksi: 'konfirmasi_pembayaran',
        entitas: 'transaksi',
        entitasId: id,
        namaEntitas: trx.nomor,
        detail: { metode_bayar: 'qris', total: trx.total, stok_kurang: adaYangMinus },
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
    if (trx.status === 'ditukar')
      throw new KesalahanAplikasi(
        'Transaksi ini sudah ditukar, jadi tidak bisa dibatalkan lagi. Batalkan transaksi penggantinya.',
        409
      );

    // Stok dikembalikan lewat baris pergerakan BARU, bukan dengan menghapus
    // baris lama. Riwayatnya harus tetap utuh dan bisa dibaca.
    if (trx.status === 'selesai') {
      const { rows: item } = await klien.query(
        'select * from transaksi_item where transaksi_id = $1',
        [id]
      );
      await gerakkanStokKeranjang(klien, {
        item,
        jenis: 'pembatalan',
        arah: 1,
        transaksiId: id,
        catatan: `Pengembalian stok dari pembatalan transaksi ${trx.nomor}`,
        user,
      });
    }

    const { rows: dibatalkan } = await klien.query(
      `update transaksi
          set status = 'batal',
              uang_masuk = 0,
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
/* Tukar barang                                                        */
/* ------------------------------------------------------------------ */

/**
 * Menukar sebagian atau seluruh isi transaksi yang SUDAH dibayar.
 *
 * Aturan harganya (keputusan K32):
 *   - barang yang TETAP dipakai harga beku dari transaksi lama, karena
 *     pembeli memang sudah membayar harga itu
 *   - barang PENGGANTI dipakai harga yang berlaku hari ini
 *
 * Hasilnya: transaksi lama ditandai `ditukar` dan transaksi BARU dibuat
 * berisi barang yang tetap ditambah barang pengganti.
 *
 * Soal uang (keputusan K33): transaksi lama tetap menyimpan uang yang dulu
 * benar-benar masuk, dan transaksi baru hanya menyimpan SELISIHNYA. Dengan
 * begitu omzet hari lama tidak ikut pindah ke hari penukaran.
 *
 * Kalau selisihnya minus, toko mengembalikan uang tunai dan sumber dananya
 * dicatat: uang kantor atau ditalangi kasir (keputusan K30).
 */
export async function tukar(id, { dikembalikan, pengganti, sumber_dana, catatan }, user) {
  if (!Array.isArray(dikembalikan) || dikembalikan.length === 0)
    throw new KesalahanAplikasi('Pilih dulu barang mana yang dikembalikan pembeli.', 400);

  return dalamTransaksi(async (klien) => {
    const { rows } = await klien.query('select * from transaksi where id = $1 for update', [id]);
    const lama = rows[0];
    if (!lama) throw tidakDitemukan('Transaksi tidak ditemukan.');
    if (lama.status !== 'selesai')
      throw new KesalahanAplikasi(
        'Hanya transaksi yang sudah selesai dibayar yang bisa ditukar.',
        400
      );

    const { rows: itemLama } = await klien.query(
      'select * from transaksi_item where transaksi_id = $1 order by urutan asc',
      [id]
    );
    const perId = new Map(itemLama.map((i) => [i.id, i]));

    /* --- 1. Barang yang dikembalikan pembeli --- */
    const barisKembali = [];
    const dikurangi = new Map();
    for (const d of dikembalikan) {
      const asli = perId.get(d.item_id);
      if (!asli)
        throw new KesalahanAplikasi('Ada barang yang tidak ada di transaksi itu.', 400);

      const sudah = dikurangi.get(d.item_id) || 0;
      const total = sudah + d.jumlah;
      if (total > asli.jumlah)
        throw new KesalahanAplikasi(
          `Jumlah ${asli.nama_barang} yang dikembalikan (${total}) melebihi yang dibeli (${asli.jumlah}).`,
          400
        );
      dikurangi.set(d.item_id, total);

      barisKembali.push({
        jenis_barang: asli.jenis_barang,
        barang_id: asli.barang_id,
        nama_barang: asli.nama_barang,
        harga_dipakai: asli.harga_dipakai,
        jumlah: d.jumlah,
        subtotal: asli.harga_dipakai * d.jumlah,
      });
    }

    /* --- 2. Barang yang tetap, harganya tetap beku --- */
    const barisTetap = [];
    let urutan = 0;
    for (const asli of itemLama) {
      const sisa = asli.jumlah - (dikurangi.get(asli.id) || 0);
      if (sisa <= 0) continue;
      barisTetap.push({
        jenis_barang: asli.jenis_barang,
        barang_id: asli.barang_id,
        nama_barang: asli.nama_barang,
        harga_normal: asli.harga_normal,
        harga_diskon: asli.harga_diskon,
        nama_diskon: asli.nama_diskon,
        harga_dipakai: asli.harga_dipakai,
        jumlah: sisa,
        subtotal: asli.harga_dipakai * sisa,
        urutan: urutan++,
      });
    }

    /* --- 3. Barang pengganti, harganya harga hari ini --- */
    let barisPengganti = [];
    if (pengganti?.length) {
      barisPengganti = (await bekukanBarang(klien, pengganti)).map((b) => ({
        ...b,
        urutan: urutan++,
      }));
    }

    if (barisTetap.length === 0 && barisPengganti.length === 0)
      throw new KesalahanAplikasi(
        'Transaksi penggantinya jadi kosong. Kalau pembeli mengembalikan semua barang tanpa pengganti, pakai tombol Batalkan transaksi.',
        400
      );

    /* --- 4. Stok: barang kembali dulu masuk, baru pengganti keluar --- */
    // Urutannya penting. Kalau pembeli menukar barang yang sama persis, stok
    // yang baru dikembalikan itulah yang dipakai untuk penggantinya.
    const barisBaru = [...barisTetap, ...barisPengganti];

    const { rows: nomorBaru } = await klien.query(
      `insert into transaksi
         (nomor, kode_struk, status, subtotal, total, uang_masuk,
          kasir_id, nama_kasir, ditukar_dari_id)
       values ($1, $2, 'menunggu_pembayaran', 0, 0, 0, $3, $4, $5)
       returning id, nomor, kode_struk`,
      [await nomorTransaksiBerikutnya(klien), kodeAcak(24), user.id, user.nama, id]
    );
    const baruId = nomorBaru[0].id;

    if (barisKembali.length) {
      await gerakkanStokKeranjang(klien, {
        item: barisKembali,
        jenis: 'penukaran_masuk',
        arah: 1,
        transaksiId: baruId,
        catatan: `Barang dikembalikan dari transaksi ${lama.nomor}`,
        user,
      });
    }

    if (barisPengganti.length) {
      await periksaKetersediaan(klien, barisPengganti);
      await gerakkanStokKeranjang(klien, {
        item: barisPengganti,
        jenis: 'penukaran_keluar',
        arah: -1,
        transaksiId: baruId,
        catatan: `Barang pengganti untuk transaksi ${lama.nomor}`,
        user,
      });
    }

    /* --- 5. Hitung uang --- */
    const subtotal = barisBaru.reduce((t, b) => t + b.subtotal, 0);
    // Diskon kasir yang dulu diberikan ikut dibawa, dihitung ulang di atas
    // nilai keranjang yang baru, supaya pembeli tidak kehilangan haknya.
    const diskonRupiah = hitungDiskon(subtotal, lama.diskon_jenis, lama.diskon_nilai);
    const total = subtotal - diskonRupiah;
    const selisih = total - lama.total;

    if (selisih < 0 && !sumber_dana)
      throw new KesalahanAplikasi(
        'Barang penggantinya lebih murah. Pilih dulu sumber uang kembaliannya: uang kantor atau ditalangi kasir.',
        400
      );

    await klien.query(
      `update transaksi
          set subtotal = $1,
              diskon_jenis = $2,
              diskon_nilai = $3,
              diskon_rupiah = $4,
              total = $5,
              uang_masuk = $6,
              status = 'selesai',
              metode_bayar = 'qris',
              nama_pembeli = $7,
              nomor_wa = $8,
              status_struk = case when $8::text is null then 'belum_diisi' else 'menunggu_kirim' end,
              dikonfirmasi_oleh_id = $9,
              nama_pengonfirmasi = $10,
              dikonfirmasi_pada = now()
        where id = $11`,
      [
        subtotal,
        diskonRupiah > 0 ? lama.diskon_jenis : null,
        diskonRupiah > 0 ? lama.diskon_nilai : null,
        diskonRupiah,
        total,
        selisih,
        lama.nama_pembeli,
        lama.nomor_wa,
        user.id,
        user.nama,
        baruId,
      ]
    );

    await simpanItem(klien, baruId, barisBaru);

    /* --- 6. Rincian penukaran, supaya riwayatnya bisa dibaca ulang --- */
    for (const b of [
      ...barisKembali.map((x) => ({ ...x, arah: 'dikembalikan' })),
      ...barisPengganti.map((x) => ({ ...x, arah: 'pengganti' })),
    ]) {
      await klien.query(
        `insert into penukaran_item
           (transaksi_baru_id, transaksi_lama_id, arah, jenis_barang, barang_id,
            nama_barang, harga_dipakai, jumlah, subtotal)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          baruId,
          id,
          b.arah,
          b.jenis_barang,
          b.barang_id,
          b.nama_barang,
          b.harga_dipakai,
          b.jumlah,
          b.subtotal,
        ]
      );
    }

    /* --- 7. Uang kembali kalau penggantinya lebih murah --- */
    if (selisih < 0) {
      await klien.query(
        `insert into pengembalian_uang
           (transaksi_id, jumlah, sumber_dana, user_id, nama_user, catatan)
         values ($1,$2,$3,$4,$5,$6)`,
        [baruId, Math.abs(selisih), sumber_dana, user.id, user.nama, catatan || null]
      );
    }

    /* --- 8. Transaksi lama ditandai ditukar, uangnya tetap tercatat --- */
    await klien.query(
      `update transaksi
          set status = 'ditukar',
              ditukar_ke_id = $1,
              ditukar_pada = now()
        where id = $2`,
      [baruId, id]
    );

    await catatLog(
      {
        user,
        aksi: 'tukar_barang',
        entitas: 'transaksi',
        entitasId: baruId,
        namaEntitas: nomorBaru[0].nomor,
        detail: {
          transaksi_lama: lama.nomor,
          total_lama: lama.total,
          total_baru: total,
          selisih,
          arah_uang:
            selisih > 0 ? 'pembeli menambah bayar' : selisih < 0 ? 'toko mengembalikan uang' : 'pas',
          sumber_dana: selisih < 0 ? sumber_dana : null,
          dikembalikan: barisKembali.map((b) => `${b.jumlah}x ${b.nama_barang}`),
          pengganti: barisPengganti.map((b) => `${b.jumlah}x ${b.nama_barang}`),
        },
      },
      klien
    );

    const { rows: hasil } = await klien.query('select * from transaksi where id = $1', [baruId]);
    const { rows: itemBaru } = await klien.query(
      'select * from transaksi_item where transaksi_id = $1 order by urutan asc',
      [baruId]
    );

    return { ...hasil[0], item: itemBaru, selisih, transaksi_lama: lama.nomor };
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
  const { rows } = await kueri(
    `select t.*,
            lama.nomor as nomor_transaksi_lama,
            baru.nomor as nomor_transaksi_baru
       from transaksi t
       left join transaksi lama on lama.id = t.ditukar_dari_id
       left join transaksi baru on baru.id = t.ditukar_ke_id
      where t.id = $1`,
    [id]
  );
  if (!rows[0]) throw tidakDitemukan('Transaksi tidak ditemukan.');

  const { rows: item } = await kueri(
    'select * from transaksi_item where transaksi_id = $1 order by urutan asc',
    [id]
  );
  const { rows: penukaran } = await kueri(
    'select * from penukaran_item where transaksi_baru_id = $1 order by arah, nama_barang',
    [id]
  );
  const { rows: kembali } = await kueri(
    'select * from pengembalian_uang where transaksi_id = $1',
    [id]
  );

  return { ...rows[0], item, penukaran, pengembalian_uang: kembali[0] || null };
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

  // Asal-usul transaksi, terpisah dari keadaannya. Satu transaksi hasil tukar
  // bisa saja ikut dibatalkan atau ditukar lagi, jadi dua hal ini tidak boleh
  // ditumpuk ke dalam satu kolom status.
  if (query.asal === 'hasil_tukar') syarat.push('t.ditukar_dari_id is not null');
  if (query.asal === 'bukan_hasil_tukar') syarat.push('t.ditukar_dari_id is null');

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
