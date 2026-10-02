// Mengisi data contoh Open Bill saja, memakai katalog dan user yang sudah ada.
import { kueri } from '../src/shared/db/pool.js';
import * as billService from '../src/features/bill/bill.service.js';
import * as trxService from '../src/features/transaksi/transaksi.service.js';

const acakInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const acakDari = (arr) => arr[Math.floor(Math.random() * arr.length)];
const peluang = (persen) => Math.random() * 100 < persen;

const NAMA = ['Rani', 'Dimas', 'Putri', 'Bagas', 'Nadia', 'Fajar', 'Wulan', 'Yoga', 'Sinta'];
const PENANDA = ['Meja 1', 'Meja 2', 'Meja 3', 'Meja 4', 'Bangku depan', 'Tenda kanan'];
const nomorAcak = () => '08' + String(acakInt(11, 89)) + String(acakInt(10000000, 99999999));

const { rows: users } = await kueri(
  "select id, nama, email, role from users where email in ('lutfi@boomboo.id','sari@boomboo.id','bagus@boomboo.id')"
);
const { rows: produk } = await kueri(
  'select id, nama from produk where diarsipkan_pada is null and dijual_satuan = true and stok > 10'
);
const { rows: menu } = await kueri('select id, nama from menu where diarsipkan_pada is null');

console.log(`user ${users.length} | produk ${produk.length} | menu ${menu.length}`);

const hasil = { terbuka: 0, selesai: 0, batal: 0 };

for (let i = 0; i < 9; i++) {
  const kasir = acakDari(users);
  let bill;
  try {
    bill = await billService.buka(
      {
        nama_pembeli: acakDari(NAMA),
        nomor_wa: peluang(80) ? nomorAcak() : null,
        penanda: peluang(70) ? acakDari(PENANDA) : null,
      },
      kasir
    );
  } catch (e) {
    console.log(`bill ${i} GAGAL DIBUKA: ${e.message}`);
    console.log(e.stack?.split('\n').slice(0, 4).join('\n'));
    break;
  }

  for (let n = 0; n < acakInt(2, 5); n++) {
    const pakaiMenu = peluang(60);
    const barang = pakaiMenu ? acakDari(menu) : acakDari(produk);
    try {
      await billService.tambahItem(
        bill.id,
        { jenis_barang: pakaiMenu ? 'menu' : 'produk', barang_id: barang.id, jumlah: acakInt(1, 2) },
        acakDari(users)
      );
    } catch (e) {
      console.log(`  item dilewati: ${e.message}`);
    }
  }

  if (i < 4) {
    hasil.terbuka++;
    continue;
  }
  if (i === 4) {
    await billService.batal(bill.id, { alasan: 'Pembeli pergi tanpa memesan lagi' }, kasir);
    hasil.batal++;
    continue;
  }

  try {
    const trx = await billService.tutup(
      bill.id,
      peluang(30) ? { diskon_jenis: 'persen', diskon_nilai: 10 } : {},
      kasir
    );
    await trxService.konfirmasi(trx.id, {}, kasir);
    hasil.selesai++;
  } catch (e) {
    console.log(`  bill ${i} gagal ditutup: ${e.message}`);
    hasil.terbuka++;
  }
}

console.log(
  `Open Bill: ${hasil.terbuka} terbuka, ${hasil.selesai} sudah dibayar, ${hasil.batal} dibatalkan`
);
process.exit(0);
