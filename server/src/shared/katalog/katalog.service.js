import { kueri } from '../db/pool.js';
import { KesalahanAplikasi, tidakDitemukan } from '../middleware/error.js';
import { catatLog, bedanya } from '../utils/log.js';
import { unggahBerkas, hapusBerkas } from '../storage/supabase.js';

/**
 * Produk dan Menu hampir sama persis: keduanya punya nama, harga, harga
 * diskon, nama diskon, dan foto. Bedanya cuma satu, Produk punya stok dan
 * Menu tidak (keputusan K1).
 *
 * Supaya aturannya tidak ditulis dua kali dan tidak bisa melenceng satu sama
 * lain, isinya dibuat sekali di sini lalu dipakai oleh kedua fitur.
 */
export function buatLayananKatalog({ tabel, entitas, punyaStok }) {
  const kolomBanding = ['nama', 'harga', 'harga_diskon', 'nama_diskon'];
  const kolomPilih = punyaStok
    ? 'id, nama, harga, harga_diskon, nama_diskon, foto_url, stok, diarsipkan_pada, dibuat_pada, diubah_pada'
    : 'id, nama, harga, harga_diskon, nama_diskon, foto_url, diarsipkan_pada, dibuat_pada, diubah_pada';

  async function ambilMentah(id) {
    const { rows } = await kueri(`select * from ${tabel} where id = $1`, [id]);
    return rows[0] || null;
  }

  async function daftar({ cari, termasuk_arsip } = {}) {
    const syarat = [];
    const nilai = [];

    if (!termasuk_arsip || termasuk_arsip === 'false') syarat.push('diarsipkan_pada is null');
    if (cari) {
      nilai.push(`%${cari}%`);
      syarat.push(`nama ilike $${nilai.length}`);
    }

    const where = syarat.length ? `where ${syarat.join(' and ')}` : '';
    const { rows } = await kueri(
      `select ${kolomPilih} from ${tabel} ${where} order by nama asc`,
      nilai
    );
    return rows;
  }

  async function ambil(id) {
    const { rows } = await kueri(`select ${kolomPilih} from ${tabel} where id = $1`, [id]);
    if (!rows[0]) throw tidakDitemukan(`${entitas} tidak ditemukan.`);
    return rows[0];
  }

  function periksaDiskon({ harga, harga_diskon, nama_diskon }) {
    if (harga_diskon === null || harga_diskon === undefined) return;
    if (!nama_diskon || !String(nama_diskon).trim())
      throw new KesalahanAplikasi('Nama diskon wajib diisi kalau harga diskon diisi.', 400);
    if (harga_diskon > harga)
      throw new KesalahanAplikasi('Harga diskon tidak boleh lebih besar dari harga normal.', 400);
  }

  async function tambah(data, user) {
    periksaDiskon(data);
    const { rows } = await kueri(
      `insert into ${tabel} (nama, harga, harga_diskon, nama_diskon)
       values ($1, $2, $3, $4)
       returning ${kolomPilih}`,
      [
        data.nama.trim(),
        data.harga,
        data.harga_diskon ?? null,
        data.harga_diskon != null ? data.nama_diskon.trim() : null,
      ]
    );
    const baru = rows[0];

    await catatLog({
      user,
      aksi: `tambah_${entitas}`,
      entitas,
      entitasId: baru.id,
      namaEntitas: baru.nama,
      detail: {
        harga: baru.harga,
        harga_diskon: baru.harga_diskon,
        nama_diskon: baru.nama_diskon,
        ...(punyaStok ? { catatan: 'Stok awal 0, diisi lewat menu Stok.' } : {}),
      },
    });

    return baru;
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

    const { rows } = await kueri(
      `update ${tabel}
          set nama = $1, harga = $2, harga_diskon = $3, nama_diskon = $4
        where id = $5
        returning ${kolomPilih}`,
      [gabung.nama, gabung.harga, gabung.harga_diskon, gabung.nama_diskon, id]
    );
    const baru = rows[0];

    const perubahan = bedanya(lama, baru, kolomBanding);
    if (perubahan) {
      await catatLog({
        user,
        aksi: `ubah_${entitas}`,
        entitas,
        entitasId: id,
        namaEntitas: baru.nama,
        detail: perubahan,
      });

      // Perubahan diskon dicatat terpisah supaya riwayatnya gampang disaring
      // sendiri, sesuai permintaan di bagian 4.4 spesifikasi.
      if (perubahan.harga_diskon || perubahan.nama_diskon) {
        await catatLog({
          user,
          aksi: 'ubah_diskon',
          entitas,
          entitasId: id,
          namaEntitas: baru.nama,
          detail: {
            harga_diskon: perubahan.harga_diskon ?? { sebelum: lama.harga_diskon, sesudah: baru.harga_diskon },
            nama_diskon: perubahan.nama_diskon ?? { sebelum: lama.nama_diskon, sesudah: baru.nama_diskon },
          },
        });
      }
    }

    return baru;
  }

  async function arsipkan(id, user) {
    const lama = await ambilMentah(id);
    if (!lama) throw tidakDitemukan(`${entitas} tidak ditemukan.`);
    if (lama.diarsipkan_pada)
      throw new KesalahanAplikasi(`${entitas} ini sudah diarsipkan.`, 400);

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

  async function simpanFoto(id, berkas, user) {
    const lama = await ambilMentah(id);
    if (!lama) throw tidakDitemukan(`${entitas} tidak ditemukan.`);
    if (!berkas) throw new KesalahanAplikasi('Belum ada gambar yang dipilih.', 400);

    const hasil = await unggahBerkas({
      buffer: berkas.buffer,
      namaAsli: berkas.originalname,
      mimetype: berkas.mimetype,
      folder: entitas,
    });

    const { rows } = await kueri(
      `update ${tabel} set foto_url = $1, foto_path = $2 where id = $3 returning ${kolomPilih}`,
      [hasil.url, hasil.path, id]
    );

    if (lama.foto_path) await hapusBerkas(lama.foto_path).catch(() => {});

    await catatLog({
      user,
      aksi: `ubah_${entitas}`,
      entitas,
      entitasId: id,
      namaEntitas: lama.nama,
      detail: { yang_diubah: 'foto' },
    });
    return rows[0];
  }

  return { daftar, ambil, ambilMentah, tambah, ubah, arsipkan, pulihkan, simpanFoto };
}
