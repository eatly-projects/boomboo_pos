import { gerakkanStok } from './pergerakan.js';
import { KesalahanAplikasi } from '../middleware/error.js';

/**
 * Menerjemahkan isi keranjang menjadi kebutuhan stok per produk.
 *
 * Produk menghabiskan dirinya sendiri. Menu menghabiskan produk-produk
 * penyusunnya (keputusan R6.2). Keduanya dijumlahkan dalam satu peta, supaya
 * kasus "paket berisi air mineral, lalu air mineralnya juga dibeli satuan di
 * keranjang yang sama" tetap dihitung benar.
 *
 * Mengembalikan Map<produk_id, { jumlah, nama }>.
 */
export async function hitungKebutuhanStok(klien, item) {
  const kebutuhan = new Map();

  const tambah = (produkId, jumlah, nama) => {
    const ada = kebutuhan.get(produkId);
    if (ada) ada.jumlah += jumlah;
    else kebutuhan.set(produkId, { jumlah, nama });
  };

  const idMenu = item.filter((i) => i.jenis_barang === 'menu').map((i) => i.barang_id);
  let komponenPerMenu = new Map();

  if (idMenu.length) {
    const { rows } = await klien.query(
      `select k.menu_id, k.produk_id, k.jumlah, p.nama as nama_produk
         from menu_komponen k
         join produk p on p.id = k.produk_id
        where k.menu_id = any($1::uuid[])`,
      [idMenu]
    );
    for (const r of rows) {
      if (!komponenPerMenu.has(r.menu_id)) komponenPerMenu.set(r.menu_id, []);
      komponenPerMenu.get(r.menu_id).push(r);
    }
  }

  for (const i of item) {
    if (i.jenis_barang === 'produk') {
      tambah(i.barang_id, i.jumlah, i.nama_barang || i.nama);
      continue;
    }
    // Menu tanpa penyusun memang tidak menyentuh stok sama sekali (K39)
    for (const k of komponenPerMenu.get(i.barang_id) || []) {
      tambah(k.produk_id, k.jumlah * i.jumlah, k.nama_produk);
    }
  }

  return kebutuhan;
}

/**
 * Memastikan seluruh kebutuhan stok terpenuhi SEBELUM apa pun ditulis.
 * Pesannya menyebut nama produk yang kurang, bukan nama menunya, supaya
 * kasir tahu persis penyusun mana yang habis (keputusan K37).
 */
export async function periksaKetersediaan(klien, item) {
  const kebutuhan = await hitungKebutuhanStok(klien, item);
  if (kebutuhan.size === 0) return;

  const { rows } = await klien.query(
    'select id, nama, stok from produk where id = any($1::uuid[])',
    [[...kebutuhan.keys()]]
  );
  const stokSekarang = new Map(rows.map((r) => [r.id, r]));

  const kurang = [];
  for (const [produkId, butuh] of kebutuhan) {
    const p = stokSekarang.get(produkId);
    if (!p) throw new KesalahanAplikasi('Ada barang yang sudah tidak tersedia.', 400);
    if (p.stok < butuh.jumlah) {
      kurang.push(`${p.nama} (sisa ${p.stok}, dibutuhkan ${butuh.jumlah})`);
    }
  }

  if (kurang.length) {
    throw new KesalahanAplikasi(`Stok tidak cukup: ${kurang.join('; ')}.`, 400);
  }
}

/**
 * Menggerakkan stok untuk satu keranjang sekaligus.
 *
 * @param arah  -1 untuk barang keluar (terjual), +1 untuk barang kembali
 */
export async function gerakkanStokKeranjang(
  klien,
  { item, jenis, arah = -1, transaksiId = null, billId = null, catatan = null, user, bolehMinus = false }
) {
  const kebutuhan = await hitungKebutuhanStok(klien, item);
  let adaYangMinus = false;

  for (const [produkId, butuh] of kebutuhan) {
    const hasil = await gerakkanStok(klien, {
      produkId,
      jenis,
      jumlah: arah * butuh.jumlah,
      transaksiId,
      billId,
      catatan,
      user,
      bolehMinus,
    });
    if (hasil.jadi_minus) adaYangMinus = true;
  }

  return { adaYangMinus, jumlahProduk: kebutuhan.size };
}

/**
 * Menghitung berapa porsi menu yang masih bisa dibuat, dilihat dari penyusun
 * yang paling sedikit. Menu tanpa penyusun tidak dibatasi stok.
 *
 * Mengembalikan Map<menu_id, { sisa, pembatas }>; sisa null berarti tak terbatas.
 */
export async function sisaPorsiMenu(klien, idMenu = null) {
  const { rows } = await klien.query(
    `select k.menu_id,
            p.nama as nama_produk,
            p.stok,
            k.jumlah as butuh,
            floor(p.stok::numeric / k.jumlah)::int as porsi
       from menu_komponen k
       join produk p on p.id = k.produk_id
      ${idMenu ? 'where k.menu_id = any($1::uuid[])' : ''}`,
    idMenu ? [idMenu] : []
  );

  const hasil = new Map();
  for (const r of rows) {
    const porsi = Math.max(r.porsi, 0);
    const ada = hasil.get(r.menu_id);
    if (!ada || porsi < ada.sisa) {
      hasil.set(r.menu_id, { sisa: porsi, pembatas: r.nama_produk });
    }
  }
  return hasil;
}
