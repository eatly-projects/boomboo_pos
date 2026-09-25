import { kueri } from '../../shared/db/pool.js';
import { dalamTransaksi } from '../../shared/db/transaksi-db.js';
import { gerakkanStok } from '../../shared/stok/pergerakan.js';
import { catatLog } from '../../shared/utils/log.js';
import { halaman } from '../../shared/utils/bantu.js';
import { KesalahanAplikasi, tidakDitemukan } from '../../shared/middleware/error.js';

/** Ringkasan stok semua produk, lengkap dengan hasil pemeriksaan silang. */
export async function ringkasan({ cari, hanya_bermasalah } = {}) {
  const syarat = ['p.diarsipkan_pada is null'];
  const nilai = [];

  if (cari) {
    nilai.push(`%${cari}%`);
    syarat.push(`p.nama ilike $${nilai.length}`);
  }

  const { rows } = await kueri(
    `select p.id, p.nama, p.stok, p.foto_url,
            coalesce(sum(g.jumlah), 0)::int as stok_menurut_buku,
            (p.stok - coalesce(sum(g.jumlah), 0))::int as selisih,
            max(g.dibuat_pada) as pergerakan_terakhir
       from produk p
       left join pergerakan_stok g on g.produk_id = p.id
      where ${syarat.join(' and ')}
      group by p.id
      order by p.nama asc`,
    nilai
  );

  const hasil = rows.map((r) => ({ ...r, cocok: r.selisih === 0 }));
  return hanya_bermasalah === 'true' ? hasil.filter((r) => !r.cocok || r.stok < 0) : hasil;
}

export async function tambah(produkId, { jumlah, catatan }, user) {
  return dalamTransaksi(async (klien) => {
    const hasil = await gerakkanStok(klien, {
      produkId,
      jenis: 'penambahan',
      jumlah: Math.abs(jumlah),
      catatan: catatan || null,
      user,
    });

    await catatLog(
      {
        user,
        aksi: 'tambah_stok',
        entitas: 'stok',
        entitasId: produkId,
        namaEntitas: hasil.nama_produk,
        detail: {
          ditambah: Math.abs(jumlah),
          stok_sebelum: hasil.stok_sebelum,
          stok_sesudah: hasil.stok_sesudah,
          catatan: catatan || null,
        },
      },
      klien
    );

    return hasil;
  });
}

export async function kurang(produkId, { jumlah, alasan, catatan }, user) {
  if (!alasan || !alasan.trim())
    throw new KesalahanAplikasi('Alasan pengurangan wajib diisi.', 400);

  return dalamTransaksi(async (klien) => {
    const hasil = await gerakkanStok(klien, {
      produkId,
      jenis: 'pengurangan_manual',
      jumlah: -Math.abs(jumlah),
      alasan: alasan.trim(),
      catatan: catatan || null,
      user,
    });

    await catatLog(
      {
        user,
        aksi: 'kurang_stok',
        entitas: 'stok',
        entitasId: produkId,
        namaEntitas: hasil.nama_produk,
        detail: {
          dikurangi: Math.abs(jumlah),
          alasan: alasan.trim(),
          stok_sebelum: hasil.stok_sebelum,
          stok_sesudah: hasil.stok_sesudah,
          catatan: catatan || null,
        },
      },
      klien
    );

    return hasil;
  });
}

/**
 * Stok opname: petugas memasukkan hasil hitung fisik, sistem otomatis
 * membuat baris penyesuaian sebesar selisihnya. Produk yang jumlahnya
 * sudah pas tidak menghasilkan baris apa pun.
 */
export async function opname(daftarHitungan, user) {
  if (!Array.isArray(daftarHitungan) || daftarHitungan.length === 0)
    throw new KesalahanAplikasi('Belum ada produk yang dihitung.', 400);

  return dalamTransaksi(async (klien) => {
    const hasil = [];

    for (const baris of daftarHitungan) {
      const { rows } = await klien.query(
        'select id, nama, stok from produk where id = $1 for update',
        [baris.produk_id]
      );
      const produk = rows[0];
      if (!produk) throw tidakDitemukan(`Produk ${baris.produk_id} tidak ditemukan.`);

      const selisih = baris.jumlah_fisik - produk.stok;
      if (selisih === 0) {
        hasil.push({
          produk_id: produk.id,
          nama_produk: produk.nama,
          stok_sistem: produk.stok,
          jumlah_fisik: baris.jumlah_fisik,
          selisih: 0,
          berubah: false,
        });
        continue;
      }

      const gerak = await gerakkanStok(klien, {
        produkId: produk.id,
        jenis: 'opname',
        jumlah: selisih,
        alasan: 'koreksi hitungan',
        catatan: baris.catatan || `Hasil hitung fisik: ${baris.jumlah_fisik}`,
        user,
        bolehMinus: true, // hasil hitung fisik adalah kenyataan, apa pun angkanya
      });

      hasil.push({
        produk_id: produk.id,
        nama_produk: produk.nama,
        stok_sistem: gerak.stok_sebelum,
        jumlah_fisik: baris.jumlah_fisik,
        selisih,
        berubah: true,
      });
    }

    const yangBerubah = hasil.filter((h) => h.berubah);
    await catatLog(
      {
        user,
        aksi: 'opname',
        entitas: 'stok',
        detail: {
          jumlah_produk_dihitung: hasil.length,
          jumlah_produk_berubah: yangBerubah.length,
          rincian: yangBerubah.map((h) => ({
            produk: h.nama_produk,
            sistem: h.stok_sistem,
            fisik: h.jumlah_fisik,
            selisih: h.selisih,
          })),
        },
      },
      klien
    );

    return hasil;
  });
}

/** Kartu stok: seluruh riwayat keluar-masuk satu produk. */
export async function kartu(produkId, query = {}) {
  const { rows: p } = await kueri('select id, nama, stok from produk where id = $1', [produkId]);
  if (!p[0]) throw tidakDitemukan('Produk tidak ditemukan.');

  const { perHalaman, halamanKe, lewati } = halaman(query);

  const { rows } = await kueri(
    `select g.*, t.nomor as nomor_transaksi
       from pergerakan_stok g
       left join transaksi t on t.id = g.transaksi_id
      where g.produk_id = $1
      order by g.dibuat_pada desc
      limit $2 offset $3`,
    [produkId, perHalaman, lewati]
  );

  const { rows: hitung } = await kueri(
    'select count(*)::int as total from pergerakan_stok where produk_id = $1',
    [produkId]
  );

  return {
    produk: p[0],
    pergerakan: rows,
    halaman: { halaman: halamanKe, per_halaman: perHalaman, total: hitung[0].total },
  };
}
