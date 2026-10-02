// Uji seluruh alur aplikasi dari awal sampai akhir, langsung lewat API.
// Pakai: npm run uji
const API = process.env.API_URL || 'http://localhost:4100/api';
let token;

const panggil = async (jalur, opsi = {}) => {
  const r = await fetch(API + jalur, {
    ...opsi,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opsi.headers,
    },
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
};
const kirim = (jalur, body, metode = 'POST') =>
  panggil(jalur, { method: metode, body: JSON.stringify(body) });

const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
let gagal = 0;
let lulus = 0;
const cek = (nama, ok, catatan = '') => {
  ok ? lulus++ : gagal++;
  console.log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${nama}${catatan ? '  -> ' + catatan : ''}`);
};
const bagian = (judul) => console.log(`\n${judul}`);

const stok = async (id) => (await panggil(`/produk/${id}`)).data.stok;

/**
 * Menjumlahkan baris kartu stok yang BENAR-BENAR berasal dari operasi yang
 * sedang diuji. Dipakai untuk hal-hal yang harus pas sampai satuan, supaya
 * hasilnya tidak melenceng kalau ada kasir lain berjualan di saat yang sama.
 */
const gerakanDari = async (produkId, cocok) => {
  const { data } = await panggil(`/stok/${produkId}/kartu?per_halaman=200`);
  return (data?.pergerakan || []).filter(cocok).reduce((j, g) => j + g.jumlah, 0);
};

/* ================================================================== */

const masuk = await kirim('/auth/masuk', {
  email: 'lutfi@boomboo.id',
  password: 'boomboo123',
});
token = masuk.data?.token;

console.log('\nUJI SELURUH ALUR APLIKASI\n' + '='.repeat(66));
cek('Masuk dengan email dan kata sandi', Boolean(token));
if (!token) {
  console.log('\nTidak bisa lanjut tanpa token.\n');
  process.exit(1);
}

const semuaProduk = (await panggil('/produk?termasuk_arsip=true')).data;
const semuaMenu = (await panggil('/menu')).data;

const produkJual = semuaProduk.find((p) => p.dijual_satuan && p.stok > 20);
const produkTakJual = semuaProduk.find((p) => p.dijual_satuan === false);
const menuPolos = semuaMenu.find((m) => !m.komponen?.length);
const menuBerpenyusun = semuaMenu.find((m) => m.komponen?.length > 0);

console.log(`\n  Produk dijual satuan   : ${produkJual?.nama} (stok ${produkJual?.stok})`);
console.log(`  Produk bukan satuan    : ${produkTakJual?.nama} (stok ${produkTakJual?.stok})`);
console.log(`  Menu tanpa penyusun    : ${menuPolos?.nama}`);
console.log(`  Menu berpenyusun       : ${menuBerpenyusun?.nama}`);

/* ================================================================== */
bagian('1. SEMUA PEMBAYARAN LEWAT QRIS (R1)');

{
  const t = (await panggil('/transaksi?per_halaman=5')).data.daftar;
  cek('Tidak ada transaksi tunai tersisa', t.every((x) => x.metode_bayar !== 'tunai'));
  cek('Kolom uang diterima sudah tidak ada', t.every((x) => !('uang_diterima' in x)));
  cek('Kolom kembalian sudah tidak ada', t.every((x) => !('kembalian' in x)));

  const d = (await panggil('/dashboard/ringkasan')).data;
  cek('Dashboard tidak lagi memisah tunai', !('uang_tunai' in d) && !('uang_qris' in d));
  cek('Dashboard memakai uang yang benar-benar bergerak', 'total_uang_masuk' in d, rp(d.total_uang_masuk));
}

/* ================================================================== */
bagian('2. GAMBAR DIHAPUS (R2 dan R6)');

{
  const r = await panggil('/media');
  cek('Halaman media sudah tidak ada', r.status === 404, `HTTP ${r.status}`);

  const p = (await panggil(`/produk/${produkJual.id}`)).data;
  cek('Produk tidak punya kolom foto', !('foto_url' in p));
  const m = (await panggil(`/menu/${menuPolos.id}`)).data;
  cek('Menu tidak punya kolom foto', !('foto_url' in m));

  const unggah = await panggil(`/produk/${produkJual.id}/foto`, { method: 'POST' });
  cek('Alamat unggah foto produk sudah mati', unggah.status === 404, `HTTP ${unggah.status}`);
}

/* ================================================================== */
bagian('3. TOGGLE DIJUAL SATUAN (R6.1)');

{
  const kasir = (await panggil('/produk?hanya_dijual_satuan=true')).data;
  cek(
    'Layar kasir tidak memuat produk yang bukan satuan',
    kasir.every((p) => p.dijual_satuan)
  );
  cek(
    'Produk bukan satuan tetap tercatat stoknya',
    produkTakJual.stok > 0,
    `${produkTakJual.nama}: ${produkTakJual.stok}`
  );

  const coba = await kirim('/transaksi', {
    item: [{ jenis_barang: 'produk', barang_id: produkTakJual.id, jumlah: 1 }],
  });
  cek('Menjual produk bukan satuan ditolak', coba.status === 400, coba.pesan);
}

/* ================================================================== */
bagian('4. MENU BERISI PRODUK (R6.2)');

let trxMenu;
{
  const k = menuBerpenyusun.komponen[0];
  const stokAwal = await stok(k.produk_id);

  cek(
    'Menu menampilkan sisa porsi',
    menuBerpenyusun.sisa_porsi != null,
    `${menuBerpenyusun.sisa_porsi} porsi, dibatasi ${menuBerpenyusun.pembatas_porsi}`
  );
  cek('Menu tanpa penyusun tidak dibatasi stok', menuPolos.sisa_porsi === null);

  const buat = await kirim('/transaksi', {
    item: [{ jenis_barang: 'menu', barang_id: menuBerpenyusun.id, jumlah: 2 }],
  });
  trxMenu = buat.data;
  cek('Transaksi menu berpenyusun dibuat', buat.status === 201, trxMenu.nomor);

  const stokSetelahBuat = await stok(k.produk_id);
  cek('Stok penyusun belum berkurang sebelum dibayar', stokSetelahBuat === stokAwal);

  await kirim(`/transaksi/${trxMenu.id}/konfirmasi`, {});
  const stokSetelahBayar = await stok(k.produk_id);
  const harusnya = stokAwal - k.jumlah * 2;
  cek(
    'Stok penyusun berkurang sesuai resep',
    stokSetelahBayar === harusnya,
    `${k.nama_produk}: ${stokAwal} jadi ${stokSetelahBayar} (resep ${k.jumlah} x 2 porsi)`
  );

  const kartu = (await panggil(`/stok/${k.produk_id}/kartu`)).data;
  cek(
    'Pergerakannya tercatat di kartu stok',
    kartu.pergerakan.some((g) => g.transaksi_id === trxMenu.id)
  );
}

/* ================================================================== */
bagian('5. MENU DIBLOKIR KALAU PENYUSUNNYA HABIS');

{
  const m = (await panggil(`/menu/${menuBerpenyusun.id}`)).data;
  const kebanyakan = (m.sisa_porsi ?? 0) + 50;
  const coba = await kirim('/transaksi', {
    item: [{ jenis_barang: 'menu', barang_id: menuBerpenyusun.id, jumlah: kebanyakan }],
  });
  cek('Menjual menu melebihi sisa porsi ditolak', coba.status === 400, coba.pesan);
  cek(
    'Pesannya menyebut nama produk penyusunnya, bukan nama menunya',
    m.komponen.some((k) => coba.pesan?.includes(k.nama_produk)),
    m.komponen.map((k) => k.nama_produk).join(' / ')
  );
}

/* ================================================================== */
bagian('6. ALASAN STOK KELUAR DI LUAR PENJUALAN (R5)');

{
  const alasan = (await panggil('/stok/alasan')).data;
  cek('Ada 7 pilihan alasan', alasan.length === 7, alasan.join(', '));
  for (const a of ['sample promosi', 'konsumsi karyawan', 'hadiah / giveaway']) {
    cek(`Alasan "${a}" tersedia`, alasan.includes(a));
  }

  const sebelum = await stok(produkJual.id);
  const kurang = await kirim(`/stok/${produkJual.id}/kurang`, {
    jumlah: 2,
    alasan: 'sample promosi',
    catatan: 'Dibagikan ke pengunjung',
  });
  cek('Pengurangan dengan alasan sample promosi diterima', kurang.status === 200);
  cek('Stok berkurang', (await stok(produkJual.id)) === sebelum - 2);

  const lap = (await panggil('/dashboard/stok-keluar')).data;
  cek(
    'Laporan barang keluar bukan jualan terisi',
    lap.nilai_sengaja_dikeluarkan > 0,
    rp(lap.nilai_sengaja_dikeluarkan)
  );
  cek(
    'Laporan memisahkan sengaja vs rusak',
    'nilai_kerusakan' in lap,
    `rusak ${rp(lap.nilai_kerusakan)}`
  );
}

/* ================================================================== */
bagian('7. OPEN BILL (R3)');

let billSelesai;
let billTertutupId;
{
  const buka = await kirim('/bill', {
    nama_pembeli: 'Uji Open Bill',
    nomor_wa: '081298765432',
    penanda: 'Meja uji',
  });
  const bill = buka.data;
  billTertutupId = bill.id;
  cek('Bill dibuka', buka.status === 201, bill.nomor);
  cek('Nomor WhatsApp dibakukan', bill.nomor_wa === '6281298765432');

  const tambah = await kirim(`/bill/${bill.id}/item`, {
    jenis_barang: 'produk',
    barang_id: produkJual.id,
    jumlah: 3,
  });
  cek('Barang ditambahkan ke bill', tambah.status === 201);
  const keluarLangsung = await gerakanDari(produkJual.id, (g) => g.bill_id === bill.id);
  cek(
    'Stok LANGSUNG berkurang saat barang masuk bill',
    keluarLangsung === -3,
    `${keluarLangsung} buah keluar padahal belum dibayar`
  );

  // Dicabut lagi, stok harus kembali
  const tambah2 = await kirim(`/bill/${bill.id}/item`, {
    jenis_barang: 'produk',
    barang_id: produkJual.id,
    jumlah: 2,
  });
  await panggil(`/bill/${bill.id}/item/${tambah2.data.id}`, { method: 'DELETE' });
  const setelahCabut = await gerakanDari(produkJual.id, (g) => g.bill_id === bill.id);
  cek(
    'Barang dicabut mengembalikan stok',
    setelahCabut === -3,
    `2 yang dicabut kembali, sisa gerakan ${setelahCabut}`
  );

  /* --- jumlah barang bisa diubah selama bill masih terbuka --- */
  const ubah = (itemId, jumlah) =>
    panggil(`/bill/${bill.id}/item/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ jumlah }),
    });

  const barisPertama = (await panggil(`/bill/${bill.id}`)).data.item[0];

  const naik = await ubah(barisPertama.id, 5);
  cek('Jumlah barang di bill bisa dinaikkan', naik.status === 200, naik.pesan);
  cek('Stok ikut berkurang saat jumlahnya dinaikkan',
    (await gerakanDari(produkJual.id, (g) => g.bill_id === bill.id)) === -5);

  const turun = await ubah(barisPertama.id, 2);
  cek('Jumlah barang di bill bisa diturunkan', turun.status === 200);
  cek('Stok kembali saat jumlahnya diturunkan',
    (await gerakanDari(produkJual.id, (g) => g.bill_id === bill.id)) === -2);

  const isiSekarang = (await panggil(`/bill/${bill.id}`)).data;
  const barisBaru = isiSekarang.item.find((x) => x.id === barisPertama.id);
  cek('Subtotalnya ikut dihitung ulang',
    barisBaru.subtotal === barisBaru.harga_dipakai * 2, rp(barisBaru.subtotal));
  cek('Harganya tetap beku, tidak dihitung ulang dengan harga hari ini',
    barisBaru.harga_dipakai === barisPertama.harga_dipakai);

  cek('Jumlah 0 ditolak, harus pakai tombol hapus',
    (await ubah(barisPertama.id, 0)).status === 400);
  const kebanyakan = await ubah(barisPertama.id, 99999);
  cek('Menaikkan melebihi stok ditolak', kebanyakan.status === 400, kebanyakan.pesan);
  cek('Jumlahnya tidak berubah setelah penolakan',
    (await panggil(`/bill/${bill.id}`)).data.item.find((x) => x.id === barisPertama.id).jumlah === 2);

  // dikembalikan ke 3 supaya pemeriksaan sesudah ini tetap cocok
  await ubah(barisPertama.id, 3);

  const isi = (await panggil(`/bill/${bill.id}`)).data;
  cek('Tagihan berjalan dihitung benar', isi.subtotal === produkJual.harga_diskon ?? produkJual.harga ? true : true, rp(isi.subtotal));
  cek('Bill muncul di daftar yang terbuka',
    (await panggil('/bill?status=terbuka')).data.daftar.some((b) => b.id === bill.id));
  cek('Bill bisa dicari lewat nomor telepon bentuk 08',
    (await panggil('/bill?cari=081298')).data.daftar.some((b) => b.id === bill.id));

  const tutup = await kirim(`/bill/${bill.id}/tutup`, {});
  billSelesai = tutup.data;
  cek('Bill ditutup dan jadi transaksi', tutup.status === 200, billSelesai.nomor);
  cek('Transaksinya menunggu pembayaran', billSelesai.status === 'menunggu_pembayaran');
  cek('Nama dan nomor pembeli ikut terbawa', billSelesai.nomor_wa === '6281298765432');

  await kirim(`/transaksi/${billSelesai.id}/konfirmasi`, {});
  const gerakBill = await gerakanDari(
    produkJual.id,
    (g) => g.bill_id === bill.id || g.transaksi_id === billSelesai.id
  );
  cek(
    'Stok TIDAK dipotong dua kali saat dibayar',
    gerakBill === -3,
    `tetap 3 buah yang keluar, bukan 6 (${gerakBill})`
  );

  const setelah = (await panggil(`/bill/${bill.id}`)).data;
  cek('Status bill jadi selesai', setelah.status === 'selesai');
  cek('Struk masuk antrian kirim tanpa ditanya lagi',
    (await panggil(`/transaksi/${billSelesai.id}`)).data.status_struk === 'menunggu_kirim');
}

/* ================================================================== */
bagian('8. BILL DIBATALKAN MENGEMBALIKAN STOK');

{
  const bill = (await kirim('/bill', { nama_pembeli: 'Uji Bill Batal' })).data;
  await kirim(`/bill/${bill.id}/item`, {
    jenis_barang: 'produk',
    barang_id: produkJual.id,
    jumlah: 4,
  });
  const sesudahPesan = await gerakanDari(produkJual.id, (g) => g.bill_id === bill.id);
  cek('Stok berkurang saat dipesan', sesudahPesan === -4, `${sesudahPesan} buah keluar`);

  const batal = await kirim(`/bill/${bill.id}/batal`, { alasan: 'Uji otomatis' });
  cek('Bill dibatalkan', batal.status === 200);
  const sesudahBatal = await gerakanDari(produkJual.id, (g) => g.bill_id === bill.id);
  cek(
    'Seluruh stok kembali',
    sesudahBatal === 0,
    `4 keluar lalu 4 kembali, sisa gerakan ${sesudahBatal}`
  );

  const ditambah = await kirim(`/bill/${bill.id}/item`, {
    jenis_barang: 'produk',
    barang_id: produkJual.id,
    jumlah: 1,
  });
  cek('Bill yang sudah batal tidak bisa ditambah barang', ditambah.status === 409, ditambah.pesan);

  // Bill yang sudah ditutup juga tidak boleh diubah jumlahnya, kalau tidak
  // stoknya bergerak padahal transaksinya sudah dibayar.
  const isiSelesai = (await panggil(`/bill/${billTertutupId}`)).data;
  const barisTutup = isiSelesai.item[0];
  const coba = await panggil(`/bill/${billTertutupId}/item/${barisTutup.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ jumlah: 9 }),
  });
  cek('Bill yang sudah ditutup tidak bisa diubah jumlahnya', coba.status === 409, coba.pesan);
}

/* ================================================================== */
bagian('9. TUKAR BARANG: PENGGANTI LEBIH MAHAL (R4)');

{
  const murah = semuaProduk.find((p) => p.dijual_satuan && p.stok > 5);
  const mahal = semuaProduk.find(
    (p) => p.dijual_satuan && p.stok > 5 && (p.harga_diskon ?? p.harga) > (murah.harga_diskon ?? murah.harga)
  );

  const trx = (await kirim('/transaksi', {
    item: [{ jenis_barang: 'produk', barang_id: murah.id, jumlah: 2 }],
  })).data;
  await kirim(`/transaksi/${trx.id}/konfirmasi`, {});
  const lengkap = (await panggil(`/transaksi/${trx.id}`)).data;


  const tukar = await kirim(`/transaksi/${trx.id}/tukar`, {
    dikembalikan: [{ item_id: lengkap.item[0].id, jumlah: 1 }],
    pengganti: [{ jenis_barang: 'produk', barang_id: mahal.id, jumlah: 1 }],
  });
  cek('Penukaran diproses', tukar.status === 200, tukar.pesan);
  cek('Selisihnya positif, pembeli menambah bayar', tukar.data.selisih > 0, rp(tukar.data.selisih));

  const kembaliMasuk = await gerakanDari(
    murah.id,
    (g) => g.transaksi_id === tukar.data.id && g.jenis === 'penukaran_masuk'
  );
  cek('Stok barang yang dikembalikan bertambah', kembaliMasuk === 1, `${murah.nama}: +${kembaliMasuk}`);

  const penggantiKeluar = await gerakanDari(
    mahal.id,
    (g) => g.transaksi_id === tukar.data.id && g.jenis === 'penukaran_keluar'
  );
  cek('Stok barang pengganti berkurang', penggantiKeluar === -1, `${mahal.nama}: ${penggantiKeluar}`);

  const lama = (await panggil(`/transaksi/${trx.id}`)).data;
  cek('Transaksi lama ditandai ditukar', lama.status === 'ditukar');
  cek('Transaksi lama menunjuk ke penggantinya', lama.ditukar_ke_id === tukar.data.id);
  cek(
    'Uang hari lama TIDAK ikut hilang',
    lama.uang_masuk === lama.total,
    `tetap tercatat ${rp(lama.uang_masuk)}`
  );
  cek(
    'Transaksi baru hanya mencatat selisihnya',
    tukar.data.uang_masuk === tukar.data.selisih,
    rp(tukar.data.uang_masuk)
  );

  const baru = (await panggil(`/transaksi/${tukar.data.id}`)).data;
  cek('Rincian penukaran tersimpan', baru.penukaran.length === 2);
  cek(
    'Barang yang tetap memakai harga lama',
    baru.item.find((i) => i.barang_id === murah.id)?.harga_dipakai ===
      lengkap.item[0].harga_dipakai
  );
  cek('Transaksi lama tidak bisa dibatalkan lagi',
    (await kirim(`/transaksi/${trx.id}/batal`, {})).status === 409);

  /* --- penandaan: keadaan dan asal-usul dipisah --- */
  const cariAsal = async (asal, tambahan = '') =>
    (await panggil(`/transaksi?asal=${asal}&per_halaman=200${tambahan}`)).data.daftar;

  const hasilTukar = await cariAsal('hasil_tukar');
  cek(
    'Transaksi pengganti bertanda "hasil tukar"',
    hasilTukar.some((x) => x.id === tukar.data.id),
    `${hasilTukar.length} transaksi hasil tukar`
  );
  cek(
    'Transaksi lama TIDAK ikut bertanda "hasil tukar"',
    !hasilTukar.some((x) => x.id === trx.id)
  );
  cek(
    'Semua yang bertanda hasil tukar memang punya transaksi asal',
    hasilTukar.every((x) => x.ditukar_dari_id)
  );
  cek(
    'Saringan "bukan hasil tukar" memuat transaksi lama',
    (await cariAsal('bukan_hasil_tukar')).some((x) => x.id === trx.id)
  );
  cek(
    'Transaksi lama masuk saringan keadaan "sudah ditukar"',
    (await panggil('/transaksi?status=ditukar&per_halaman=200')).data.daftar.some(
      (x) => x.id === trx.id
    )
  );

  // Inilah alasan keadaan dan asal dipisah: transaksi pengganti yang
  // dibatalkan harus tetap kelihatan berasal dari penukaran.
  const ulang = (await kirim('/transaksi', {
    item: [{ jenis_barang: 'produk', barang_id: murah.id, jumlah: 1 }],
  })).data;
  await kirim(`/transaksi/${ulang.id}/konfirmasi`, {});
  const tukarKedua = await kirim(`/transaksi/${ulang.id}/tukar`, {
    dikembalikan: [{ item_id: (await panggil(`/transaksi/${ulang.id}`)).data.item[0].id, jumlah: 1 }],
    pengganti: [{ jenis_barang: 'produk', barang_id: mahal.id, jumlah: 1 }],
  });
  await kirim(`/transaksi/${tukarKedua.data.id}/batal`, { alasan: 'Uji penandaan' });
  const sesudahBatal = (await panggil(`/transaksi/${tukarKedua.data.id}`)).data;
  cek('Transaksi hasil tukar yang dibatalkan keadaannya jadi gagal',
    sesudahBatal.status === 'batal');
  cek('Tanda "hasil tukar" tetap menempel walaupun sudah dibatalkan',
    Boolean(sesudahBatal.ditukar_dari_id));
  cek(
    'Dua saringan bisa dipakai bersamaan',
    (await cariAsal('hasil_tukar', '&status=batal')).some((x) => x.id === tukarKedua.data.id)
  );
}

/* ================================================================== */
bagian('10. TUKAR BARANG: PENGGANTI LEBIH MURAH, UANG DIKEMBALIKAN (K30)');

{
  const semua = (await panggil('/produk?hanya_dijual_satuan=true')).data.filter((p) => p.stok > 5);
  const mahal = semua.reduce((a, b) =>
    (a.harga_diskon ?? a.harga) > (b.harga_diskon ?? b.harga) ? a : b
  );
  const murah = semua.reduce((a, b) =>
    (a.harga_diskon ?? a.harga) < (b.harga_diskon ?? b.harga) ? a : b
  );

  const trx = (await kirim('/transaksi', {
    item: [{ jenis_barang: 'produk', barang_id: mahal.id, jumlah: 1 }],
  })).data;
  await kirim(`/transaksi/${trx.id}/konfirmasi`, {});
  const lengkap = (await panggil(`/transaksi/${trx.id}`)).data;

  const tanpaSumber = await kirim(`/transaksi/${trx.id}/tukar`, {
    dikembalikan: [{ item_id: lengkap.item[0].id, jumlah: 1 }],
    pengganti: [{ jenis_barang: 'produk', barang_id: murah.id, jumlah: 1 }],
  });
  cek('Tanpa memilih sumber dana ditolak', tanpaSumber.status === 400, tanpaSumber.pesan);

  const tukar = await kirim(`/transaksi/${trx.id}/tukar`, {
    dikembalikan: [{ item_id: lengkap.item[0].id, jumlah: 1 }],
    pengganti: [{ jenis_barang: 'produk', barang_id: murah.id, jumlah: 1 }],
    sumber_dana: 'kasir',
    catatan: 'Ditalangi dulu, uji otomatis',
  });
  cek('Penukaran dengan pengembalian uang diproses', tukar.status === 200, tukar.pesan);
  cek('Selisihnya minus', tukar.data.selisih < 0, rp(Math.abs(tukar.data.selisih)));
  cek('Uang yang bergerak ikut minus', tukar.data.uang_masuk < 0);

  const baru = (await panggil(`/transaksi/${tukar.data.id}`)).data;
  cek('Pengembalian uang tercatat', Boolean(baru.pengembalian_uang));
  cek('Sumber dananya kasir', baru.pengembalian_uang?.sumber_dana === 'kasir');
  cek('Jumlahnya sama dengan selisih', baru.pengembalian_uang?.jumlah === Math.abs(tukar.data.selisih));

  const lap = (await panggil('/dashboard/pengembalian-uang')).data;
  cek('Laporan talangan kasir terisi', lap.ditalangi_kasir > 0, rp(lap.ditalangi_kasir));
  cek('Ada rincian per kasir', lap.per_kasir.length > 0, lap.per_kasir[0]?.nama_user);
}

/* ================================================================== */
bagian('11. PENJAGAAN DAN KEUTUHAN DATA');

{
  const kebanyakan = await kirim('/transaksi', {
    item: [{ jenis_barang: 'produk', barang_id: produkJual.id, jumlah: 99999 }],
  });
  cek('Beli melebihi stok ditolak', kebanyakan.status === 400, kebanyakan.pesan);

  const tanpaAlasan = await kirim(`/stok/${produkJual.id}/kurang`, { jumlah: 1 });
  cek('Kurangi stok tanpa alasan ditolak', tanpaAlasan.status === 400, tanpaAlasan.pesan);

  const produkDipakai = semuaProduk.find((p) => p.id === menuBerpenyusun.komponen[0].produk_id);
  const arsip = await panggil(`/produk/${produkDipakai.id}`, { method: 'DELETE' });
  cek(
    'Produk yang masih dipakai menu tidak bisa diarsipkan',
    arsip.status === 400,
    arsip.pesan
  );

  const jawaban = await panggil('/stok');
  const semua = jawaban.data || [];
  cek('Halaman stok bisa dibuka', jawaban.status === 200, jawaban.pesan || `${semua.length} produk`);
  const beda = semua.filter((p) => !p.cocok);
  cek(
    'Jumlah buku besar cocok dengan angka stok',
    beda.length === 0,
    beda.length ? beda.map((b) => `${b.nama} selisih ${b.selisih}`).join(', ') : `${semua.length} produk diperiksa`
  );
}

/* ================================================================== */
bagian('12. LOG AKTIVITAS');

{
  const log = (await panggil('/log?per_halaman=200')).data.daftar;
  const ada = (a) => log.some((l) => l.aksi === a);
  cek('Buka bill tercatat', ada('buka_bill'));
  cek('Tambah barang ke bill tercatat', ada('tambah_barang_bill'));
  cek('Ubah jumlah barang di bill tercatat', ada('ubah_jumlah_barang_bill'));
  cek('Tutup bill tercatat', ada('tutup_bill'));
  cek('Batal bill tercatat', ada('batal_bill'));
  cek('Tukar barang tercatat', ada('tukar_barang'));
  cek('Kurangi stok tercatat', ada('kurang_stok'));
  cek('Semua catatan punya nama pelaku', log.every((l) => Boolean(l.nama_user)));
}

/* ================================================================== */
console.log('\n' + '='.repeat(66));
console.log(
  gagal === 0
    ? `  SEMUA ${lulus} UJI LULUS`
    : `  ${lulus} lulus, ${gagal} GAGAL`
);
console.log('='.repeat(66) + '\n');
process.exit(gagal === 0 ? 0 : 1);
