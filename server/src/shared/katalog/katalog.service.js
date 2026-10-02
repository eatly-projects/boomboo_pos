import { kueri } from '../db/pool.js';
import { dalamTransaksi } from '../db/transaksi-db.js';
import { KesalahanAplikasi, tidakDitemukan } from '../middleware/error.js';
import { catatLog, bedanya } from '../utils/log.js';
import { sisaPorsiMenu } from '../stok/penjualan.js';

/**
 * Produk dan Menu masih berbagi sebagian besar aturan: nama, harga, harga
 * diskon, nama diskon, dan pengarsipan. Bedanya sekarang ada dua:
 *
 *   Produk  punya stok, dan punya saklar "dijual satuan" (R6.1). Kalau
 *           saklarnya mati, stoknya tetap dicatat tapi barangnya tidak
 *           muncul di layar kasir - dipakai sebagai penyusun menu saja.
 *
 *   Menu    tidak punya stok sendiri, tapi boleh punya PENYUSUN berupa
 *           produk berstok (R6.2). Menu tanpa penyusun tetap boleh ada dan
 *           tidak menyentuh stok sama sekali.
 */
export function buatLayananKatalog({ tabel, entitas, punyaStok, punyaKomponen }) {
  const kolomBanding = ['nama', 'harga', 'harga_diskon', 'nama_diskon'];
  const kolomPilih = punyaStok
    ? 'id, nama, harga, harga_diskon, nama_diskon, stok, dijual_satuan, diarsipkan_pada, dibuat_pada, diubah_pada'
    : 'id, nama, harga, harga_diskon, nama_diskon, diarsipkan_pada, dibuat_pada, diubah_pada';

  async function ambilMentah(id) {
    const { rows } = await kueri(`select * from ${tabel} where id = $1`, [id]);
    return rows[0] || null;
  }

  /** Menempelkan daftar penyusun dan sisa porsi ke tiap menu. */
  async function lengkapiKomponen(daftarMenu) {
    if (!punyaKomponen || daftarMenu.length === 0) return daftarMenu;

    const idMenu = daftarMenu.map((m) => m.id);
    const { rows } = await kueri(
      `select k.menu_id, k.produk_id, k.jumlah, p.nama as nama_produk, p.stok
         from menu_komponen k
         join produk p on p.id = k.produk_id
        where k.menu_id = any($1::uuid[])
        order by p.nama`,
      [idMenu]
    );

    const perMenu = new Map();
    for (const r of rows) {
      if (!perMenu.has(r.menu_id)) perMenu.set(r.menu_id, []);
      perMenu.get(r.menu_id).push({
        produk_id: r.produk_id,
        nama_produk: r.nama_produk,
        jumlah: r.jumlah,
        stok_produk: r.stok,
      });
    }

    const porsi = await sisaPorsiMenu({ query: kueri }, idMenu);

    return daftarMenu.map((m) => {
      const komponen = perMenu.get(m.id) || [];
      const batas = porsi.get(m.id);
      return {
        ...m,
        komponen,
        // null berarti menu ini tidak dibatasi stok sama sekali
        sisa_porsi: komponen.length ? (batas ? batas.sisa : 0) : null,
        pembatas_porsi: komponen.length && batas ? batas.pembatas : null,
      };
    });
  }

  async function daftar({ cari, termasuk_arsip, hanya_dijual_satuan } = {}) {
    const syarat = [];
    const nilai = [];

    if (!termasuk_arsip || termasuk_arsip === 'false') syarat.push('diarsipkan_pada is null');
    if (punyaStok && (hanya_dijual_satuan === true || hanya_dijual_satuan === 'true'))
      syarat.push('dijual_satuan = true');
    if (cari) {
      nilai.push(`%${cari}%`);
      syarat.push(`nama ilike $${nilai.length}`);
    }

    const where = syarat.length ? `where ${syarat.join(' and ')}` : '';
    const { rows } = await kueri(
      `select ${kolomPilih} from ${tabel} ${where} order by nama asc`,
      nilai
    );
    return lengkapiKomponen(rows);
  }

  async function ambil(id) {
    const { rows } = await kueri(`select ${kolomPilih} from ${tabel} where id = $1`, [id]);
    if (!rows[0]) throw tidakDitemukan(`${entitas} tidak ditemukan.`);
    const [lengkap] = await lengkapiKomponen(rows);
    return lengkap;
  }

  function periksaDiskon({ harga, harga_diskon, nama_diskon }) {
    if (harga_diskon === null || harga_diskon === undefined) return;
    if (!nama_diskon || !String(nama_diskon).trim())
      throw new KesalahanAplikasi('Nama diskon wajib diisi kalau harga diskon diisi.', 400);
    if (harga_diskon > harga)
      throw new KesalahanAplikasi('Harga diskon tidak boleh lebih besar dari harga normal.', 400);
  }

  /** Menulis ulang seluruh penyusun satu menu. */
  async function simpanKomponen(klien, menuId, komponen) {
    await klien.query('delete from menu_komponen where menu_id = $1', [menuId]);
    if (!komponen?.length) return [];

    const idProduk = komponen.map((k) => k.produk_id);
    const { rows: ada } = await klien.query(
      'select id, nama from produk where id = any($1::uuid[]) and diarsipkan_pada is null',
      [idProduk]
    );
    if (ada.length !== new Set(idProduk).size)
      throw new KesalahanAplikasi('Ada produk penyusun yang tidak ditemukan atau sudah diarsipkan.', 400);

    for (const k of komponen) {
      await klien.query(
        'insert into menu_komponen (menu_id, produk_id, jumlah) values ($1, $2, $3)',
        [menuId, k.produk_id, k.jumlah]
      );
    }
    return ada;
  }

  async function tambah(data, user) {
    periksaDiskon(data);

    return dalamTransaksi(async (klien) => {
      const kolom = ['nama', 'harga', 'harga_diskon', 'nama_diskon'];
      const isi = [
        data.nama.trim(),
        data.harga,
        data.harga_diskon ?? null,
        data.harga_diskon != null ? data.nama_diskon.trim() : null,
      ];
      if (punyaStok) {
        kolom.push('dijual_satuan');
        isi.push(data.dijual_satuan ?? true);
      }

      const { rows } = await klien.query(
        `insert into ${tabel} (${kolom.join(', ')})
         values (${kolom.map((_, i) => `$${i + 1}`).join(', ')})
         returning ${kolomPilih}`,
        isi
      );
      const baru = rows[0];

      let namaKomponen = [];
      if (punyaKomponen && data.komponen?.length) {
        namaKomponen = await simpanKomponen(klien, baru.id, data.komponen);
      }

      await catatLog(
        {
          user,
          aksi: `tambah_${entitas}`,
          entitas,
          entitasId: baru.id,
          namaEntitas: baru.nama,
          detail: {
            harga: baru.harga,
            harga_diskon: baru.harga_diskon,
            nama_diskon: baru.nama_diskon,
            ...(punyaStok
              ? {
                  dijual_satuan: baru.dijual_satuan,
                  catatan: 'Stok awal 0, diisi lewat menu Stok.',
                }
              : {}),
            ...(namaKomponen.length
              ? { penyusun: namaKomponen.map((k) => k.nama) }
              : {}),
          },
        },
        klien
      );

      return baru;
    });
  }

  async function ubah(id, data, user) {
    const lama = await ambilMentah(id);
    if (!lama) throw tidakDitemukan(`${entitas} tidak ditemukan.`);

    const gabung = {
      nama: data.nama !== undefined ? data.nama.trim() : lama.nama,
      harga: data.harga !== undefined ? data.harga : lama.harga,
      harga_diskon: data.harga_diskon !== undefined ? data.harga_diskon : lama.harga_diskon,
      nama_diskon: data.nama_diskon !== undefined ? data.nama_diskon : lama.nama_diskon,
    };
    if (gabung.harga_diskon == null) gabung.nama_diskon = null;
    periksaDiskon(gabung);

    return dalamTransaksi(async (klien) => {
      const set = ['nama = $1', 'harga = $2', 'harga_diskon = $3', 'nama_diskon = $4'];
      const isi = [gabung.nama, gabung.harga, gabung.harga_diskon, gabung.nama_diskon];

      if (punyaStok && data.dijual_satuan !== undefined) {
        isi.push(data.dijual_satuan);
        set.push(`dijual_satuan = $${isi.length}`);
      }
      isi.push(id);

      const { rows } = await klien.query(
        `update ${tabel} set ${set.join(', ')} where id = $${isi.length} returning ${kolomPilih}`,
        isi
      );
      const baru = rows[0];

      if (punyaKomponen && data.komponen !== undefined) {
        await simpanKomponen(klien, id, data.komponen);
      }

      const perubahan = bedanya(lama, baru, kolomBanding);
      const saklarBerubah =
        punyaStok && data.dijual_satuan !== undefined && lama.dijual_satuan !== baru.dijual_satuan;

      if (perubahan || saklarBerubah || data.komponen !== undefined) {
        await catatLog(
          {
            user,
            aksi: `ubah_${entitas}`,
            entitas,
            entitasId: id,
            namaEntitas: baru.nama,
            detail: {
              ...(perubahan || {}),
              ...(saklarBerubah
                ? { dijual_satuan: { sebelum: lama.dijual_satuan, sesudah: baru.dijual_satuan } }
                : {}),
              ...(data.komponen !== undefined
                ? { yang_diubah: 'daftar penyusun menu' }
                : {}),
            },
          },
          klien
        );

        if (perubahan?.harga_diskon || perubahan?.nama_diskon) {
          await catatLog(
            {
              user,
              aksi: 'ubah_diskon',
              entitas,
              entitasId: id,
              namaEntitas: baru.nama,
              detail: {
                harga_diskon: { sebelum: lama.harga_diskon, sesudah: baru.harga_diskon },
                nama_diskon: { sebelum: lama.nama_diskon, sesudah: baru.nama_diskon },
              },
            },
            klien
          );
        }
      }

      return baru;
    });
  }

  async function arsipkan(id, user) {
    const lama = await ambilMentah(id);
    if (!lama) throw tidakDitemukan(`${entitas} tidak ditemukan.`);
    if (lama.diarsipkan_pada)
      throw new KesalahanAplikasi(`${entitas} ini sudah diarsipkan.`, 400);

    // Produk yang masih dipakai menu tidak boleh diarsipkan begitu saja,
    // nanti menunya jadi tidak bisa dijual tanpa penjelasan.
    if (punyaStok) {
      const { rows } = await kueri(
        `select m.nama from menu_komponen k
           join menu m on m.id = k.menu_id
          where k.produk_id = $1 and m.diarsipkan_pada is null`,
        [id]
      );
      if (rows.length)
        throw new KesalahanAplikasi(
          `Produk ini masih dipakai sebagai penyusun menu: ${rows.map((r) => r.nama).join(', ')}. Lepaskan dulu dari menunya.`,
          400
        );
    }

    const { rows } = await kueri(
      `update ${tabel} set diarsipkan_pada = now() where id = $1 returning ${kolomPilih}`,
      [id]
    );
    await catatLog({
      user,
      aksi: `arsip_${entitas}`,
      entitas,
      entitasId: id,
      namaEntitas: lama.nama,
      detail: { catatan: 'Hilang dari layar kasir, tapi data lama tetap utuh.' },
    });
    return rows[0];
  }

  async function pulihkan(id, user) {
    const lama = await ambilMentah(id);
    if (!lama) throw tidakDitemukan(`${entitas} tidak ditemukan.`);

    const { rows } = await kueri(
      `update ${tabel} set diarsipkan_pada = null where id = $1 returning ${kolomPilih}`,
      [id]
    );
    await catatLog({
      user,
      aksi: `pulihkan_${entitas}`,
      entitas,
      entitasId: id,
      namaEntitas: lama.nama,
    });
    return rows[0];
  }

  return { daftar, ambil, ambilMentah, tambah, ubah, arsipkan, pulihkan };
}
