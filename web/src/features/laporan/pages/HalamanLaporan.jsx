import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuFileSpreadsheet, LuPrinter, LuCalendar, LuTriangleAlert, LuFileText,
  LuTrendingUp, LuReceipt, LuScale, LuTicketPercent,
} from 'react-icons/lu';
import { ambil, api } from '@/shared/lib/api';
import {
  rupiah, angka, tanggalLengkap, tanggalPanjang, keIsoTanggal, rentangTanggal, jam,
} from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { KepalaHalaman, Kosong, Rangka, Pemberitahuan } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

const PILIHAN = [
  { nilai: 'hari_ini', label: 'Hari ini' },
  { nilai: 'satu', label: 'Pilih tanggal' },
  { nilai: 'rentang', label: 'Beberapa hari' },
];

/* ---------------------------------------------------------------- */
/* Bagian-bagian laporan                                             */
/* ---------------------------------------------------------------- */

function AngkaBesar({ judul, nilai, keterangan, utama }) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 p-4',
        utama ? 'border-boom-500 bg-boom-50' : 'border-netral-200 bg-white'
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-coklat-400">{judul}</p>
      <p
        className={cn(
          'angka mt-1.5 font-extrabold tracking-tight',
          utama ? 'text-2xl text-boom-600 sm:text-3xl' : 'text-xl text-coklat-900 sm:text-2xl'
        )}
      >
        {nilai}
      </p>
      {keterangan && <p className="mt-1 text-xs text-coklat-400">{keterangan}</p>}
    </div>
  );
}

function Bagian({ judul, keterangan, children, kosong }) {
  return (
    <section className="hindari-potong-cetak rounded-2xl border-2 border-netral-200 bg-white">
      <div className="border-b-2 border-netral-200 px-4 py-3">
        <h2 className="font-bold text-coklat-900">{judul}</h2>
        {keterangan && <p className="mt-0.5 text-xs text-coklat-400">{keterangan}</p>}
      </div>
      {kosong ? (
        <p className="px-4 py-6 text-center text-sm text-coklat-400">{kosong}</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </section>
  );
}

function Tabel({ kepala, children, rata = [] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b-2 border-netral-100">
          {kepala.map((k, i) => (
            <th
              key={k}
              className={cn(
                'px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-coklat-400',
                rata[i] === 'kanan' ? 'text-right' : 'text-left'
              )}
            >
              {k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-netral-100">{children}</tbody>
    </table>
  );
}

const Sel = ({ kanan, tebal, children, className }) => (
  <td
    className={cn(
      'px-4 py-2.5 text-coklat-900',
      kanan && 'angka text-right',
      tebal && 'font-bold',
      className
    )}
  >
    {children}
  </td>
);

/** Bilah mendatar sederhana untuk membandingkan jam ramai. */
function BilahJam({ data }) {
  const puncak = Math.max(...data.map((j) => j.total), 1);
  return (
    <div className="space-y-1.5 px-4 py-3">
      {data.map((j) => (
        <div key={j.jam} className="flex items-center gap-3">
          <span className="angka w-16 shrink-0 text-xs text-coklat-400">
            {String(j.jam).padStart(2, '0')}.00
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-netral-100">
            <div
              className="h-full rounded-md bg-boom-500"
              style={{ width: `${Math.max((j.total / puncak) * 100, 2)}%` }}
            />
          </div>
          <span className="angka w-28 shrink-0 text-right text-xs font-semibold text-coklat-900">
            {rupiah(j.total)}
          </span>
          <span className="angka w-16 shrink-0 text-right text-xs text-coklat-400">
            {j.jumlah_transaksi} trx
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */

export default function HalamanLaporan() {
  const hariIni = keIsoTanggal(new Date());
  const [mode, setMode] = useState('hari_ini');
  const [dari, setDari] = useState(hariIni);
  const [sampai, setSampai] = useState(hariIni);
  const [sedangUnduh, setSedangUnduh] = useState(false);

  const tglDari = mode === 'hari_ini' ? hariIni : dari;
  const tglSampai = mode === 'rentang' ? sampai : tglDari;
  const sah = tglDari && tglSampai && tglSampai >= tglDari;

  const params = { tanggal_dari: tglDari, tanggal_sampai: tglSampai };

  const laporan = useQuery({
    queryKey: ['laporan', params],
    queryFn: () => ambil('/laporan', { params }),
    enabled: sah,
  });

  const d = laporan.data;

  async function unduhExcel() {
    setSedangUnduh(true);
    try {
      // responseType blob, jadi isinya ada di .data - bukan dibongkar seperti
      // jawaban JSON biasa.
      const { data: berkas } = await api.get('/laporan/excel', {
        params,
        responseType: 'blob',
      });
      const nama =
        tglDari === tglSampai
          ? `Laporan-Penjualan-Boomboo-${tglDari}.xlsx`
          : `Laporan-Penjualan-Boomboo-${tglDari}-sampai-${tglSampai}.xlsx`;
      const url = URL.createObjectURL(berkas);
      const a = document.createElement('a');
      a.href = url;
      a.download = nama;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Berkas Excel diunduh.');
    } catch {
      toast.error('Gagal membuat berkas Excel.');
    } finally {
      setSedangUnduh(false);
    }
  }

  const adaIsi = d && d.ringkasan.jumlah_transaksi > 0;

  return (
    <div>
      {/* ---- Penyaring: tidak ikut tercetak ---- */}
      <div className="sembunyi-saat-cetak">
        <KepalaHalaman
          judul="Laporan Penjualan"
          keterangan="Pilih tanggalnya, lalu cetak jadi PDF atau unduh sebagai Excel."
        />

        <div className="mb-5 rounded-2xl border-2 border-netral-200 bg-white p-4">
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-netral-100 p-1">
            {PILIHAN.map((p) => (
              <button
                key={p.nilai}
                type="button"
                onClick={() => setMode(p.nilai)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors',
                  mode === p.nilai
                    ? 'bg-boom-500 text-white'
                    : 'text-coklat-600 hover:bg-white hover:text-coklat-900'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {mode !== 'hari_ini' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-coklat-900">
                  {mode === 'rentang' ? 'Tanggal mulai' : 'Tanggal laporan'}
                </span>
                <Input
                  type="date"
                  max={hariIni}
                  value={dari}
                  onChange={(e) => setDari(e.target.value)}
                />
              </label>
              {mode === 'rentang' && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-coklat-900">
                    Tanggal akhir
                  </span>
                  <Input
                    type="date"
                    min={dari}
                    max={hariIni}
                    value={sampai}
                    onChange={(e) => setSampai(e.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          {!sah && (
            <p className="mt-3 text-sm font-semibold text-boom-600">
              Tanggal akhir tidak boleh lebih awal dari tanggal mulai.
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              ukuran="besar"
              className="sm:flex-1"
              onClick={() => window.print()}
              disabled={!adaIsi}
            >
              <LuPrinter /> Cetak atau simpan PDF
            </Button>
            <Button
              variant="garis"
              ukuran="besar"
              className="sm:flex-1"
              onClick={unduhExcel}
              disabled={!adaIsi || sedangUnduh}
            >
              <LuFileSpreadsheet /> {sedangUnduh ? 'Menyiapkan...' : 'Unduh Excel'}
            </Button>
          </div>
        </div>
      </div>

      {/* ---- Isi laporan: inilah yang tercetak ---- */}
      {laporan.isLoading ? (
        <div className="space-y-3">
          <Rangka className="h-28 rounded-2xl" />
          <Rangka className="h-40 rounded-2xl" />
          <Rangka className="h-64 rounded-2xl" />
        </div>
      ) : !adaIsi ? (
        <Kosong
          ikon={LuFileText}
          judul="Belum ada penjualan pada tanggal itu"
          keterangan={`Tidak ada transaksi yang berhasil pada ${rentangTanggal(tglDari, tglSampai)}. Coba pilih tanggal lain.`}
        />
      ) : (
        <div id="isi-laporan" className="space-y-4">
          {/* Kepala bermerek */}
          <div className="hindari-potong-cetak overflow-hidden rounded-2xl border-2 border-boom-500">
            <div className="flex items-center justify-between gap-4 bg-boom-500 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70">
                  Laporan Penjualan
                </p>
                <p className="mt-0.5 text-lg font-extrabold text-white sm:text-xl">
                  {d.satu_hari
                    ? tanggalLengkap(tglDari + 'T00:00:00')
                    : `${tanggalPanjang(tglDari + 'T00:00:00')} sampai ${tanggalPanjang(tglSampai + 'T00:00:00')}`}
                </p>
              </div>
              <img
                src="/merek/logo-utama-putih.svg"
                alt="Boomboo"
                className="h-9 w-auto shrink-0 sm:h-11"
              />
            </div>
            <p className="bg-biji-100 px-5 py-2 text-xs text-coklat-600">
              Dicetak {tanggalPanjang(d.dibuat_pada)}, {jam(d.dibuat_pada)} &middot; Aplikasi Kasir
              Boomboo
            </p>
          </div>

          {/* Empat angka utama */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AngkaBesar
              utama
              judul="Uang masuk"
              nilai={rupiah(d.ringkasan.total_uang_masuk)}
              keterangan="Uang yang benar-benar diterima"
            />
            <AngkaBesar
              judul="Transaksi berhasil"
              nilai={angka(d.ringkasan.jumlah_transaksi)}
              keterangan={
                d.ringkasan.jumlah_batal > 0
                  ? `${d.ringkasan.jumlah_batal} dibatalkan`
                  : 'Tidak ada yang dibatalkan'
              }
            />
            <AngkaBesar
              judul="Rata-rata per transaksi"
              nilai={rupiah(d.ringkasan.rata_rata_per_transaksi)}
            />
            <AngkaBesar
              judul="Diskon diberikan"
              nilai={rupiah(d.ringkasan.total_diskon)}
              keterangan={`Dari ${rupiah(d.ringkasan.total_sebelum_diskon)} sebelum diskon`}
            />
          </div>

          {d.ringkasan.transaksi_stok_kurang > 0 && (
            <Pemberitahuan warna="merah" ikon={LuTriangleAlert} judul="Ada transaksi dengan stok kurang">
              {d.ringkasan.transaksi_stok_kurang} transaksi diloloskan walaupun stoknya keburu
              habis diambil kasir lain. Stok fisiknya perlu diperiksa.
            </Pemberitahuan>
          )}

          {/* Per hari, hanya kalau rentangnya lebih dari satu hari */}
          {!d.satu_hari && d.per_hari.length > 1 && (
            <Bagian judul="Uang masuk per hari">
              <Tabel kepala={['Tanggal', 'Transaksi', 'Uang masuk']} rata={[null, 'kanan', 'kanan']}>
                {d.per_hari.map((h) => (
                  <tr key={h.tanggal}>
                    <Sel>{tanggalLengkap(h.tanggal)}</Sel>
                    <Sel kanan>{angka(h.jumlah_transaksi)}</Sel>
                    <Sel kanan tebal>{rupiah(h.total)}</Sel>
                  </tr>
                ))}
              </Tabel>
            </Bagian>
          )}

          <Bagian
            judul="Barang terjual"
            keterangan="Urut dari yang paling laku"
            kosong={d.terlaris.length === 0 ? 'Belum ada barang terjual.' : null}
          >
            <Tabel
              kepala={['Nama barang', 'Jenis', 'Terjual', 'Nilai penjualan']}
              rata={[null, null, 'kanan', 'kanan']}
            >
              {d.terlaris.map((t) => (
                <tr key={`${t.jenis_barang}:${t.nama_barang}`}>
                  <Sel tebal>{t.nama_barang}</Sel>
                  <Sel className="text-coklat-400">
                    {t.jenis_barang === 'menu' ? 'Menu makan' : 'Produk'}
                  </Sel>
                  <Sel kanan>{angka(t.jumlah_terjual)}</Sel>
                  <Sel kanan tebal>{rupiah(t.total_penjualan)}</Sel>
                </tr>
              ))}
            </Tabel>
          </Bagian>

          <Bagian judul="Penjualan per kasir">
            <Tabel
              kepala={['Nama kasir', 'Transaksi', 'Uang masuk', 'Diskon diberikan']}
              rata={[null, 'kanan', 'kanan', 'kanan']}
            >
              {d.per_kasir.map((k) => (
                <tr key={k.nama_kasir}>
                  <Sel tebal>{k.nama_kasir}</Sel>
                  <Sel kanan>{angka(k.jumlah_transaksi)}</Sel>
                  <Sel kanan tebal>{rupiah(k.total)}</Sel>
                  <Sel kanan className="text-daun-700">{rupiah(k.total_diskon)}</Sel>
                </tr>
              ))}
            </Tabel>
          </Bagian>

          {d.per_jam.length > 0 && (
            <Bagian judul="Jam ramai" keterangan="Waktu Jakarta">
              <BilahJam data={d.per_jam} />
            </Bagian>
          )}

          {d.stok_keluar.rincian.length > 0 && (
            <Bagian
              judul="Barang keluar bukan karena dijual"
              keterangan="Nilainya memakai harga jual, bukan harga modal. Baca catatannya sebelum menyimpulkan ini kerugian."
            >
              <Tabel
                kepala={['Waktu', 'Barang', 'Jumlah', 'Alasan', 'Catatan', 'Nilai']}
                rata={[null, null, 'kanan', null, null, 'kanan']}
              >
                {d.stok_keluar.rincian.map((s, i) => (
                  <tr key={i}>
                    <Sel className="whitespace-nowrap text-coklat-400">
                      {tanggalPanjang(s.dibuat_pada)}, {jam(s.dibuat_pada)}
                    </Sel>
                    <Sel tebal>{s.nama_produk}</Sel>
                    <Sel kanan>{angka(s.jumlah)}</Sel>
                    <Sel>{s.alasan}</Sel>
                    <Sel className={s.catatan ? 'font-semibold text-biji-700' : 'text-coklat-400'}>
                      {s.catatan || '-'}
                    </Sel>
                    <Sel kanan tebal>{rupiah(s.nilai)}</Sel>
                  </tr>
                ))}
              </Tabel>
            </Bagian>
          )}

          {d.pengembalian.jumlah_kejadian > 0 && (
            <Bagian judul="Pengembalian uang ke pembeli">
              <Tabel
                kepala={['Sumber dana', 'Jumlah']}
                rata={[null, 'kanan']}
              >
                <tr>
                  <Sel>Uang kantor</Sel>
                  <Sel kanan tebal>{rupiah(d.pengembalian.dari_kantor)}</Sel>
                </tr>
                <tr>
                  <Sel>Ditalangi kasir</Sel>
                  <Sel kanan tebal>{rupiah(d.pengembalian.ditalangi_kasir)}</Sel>
                </tr>
                <tr>
                  <Sel className="text-boom-600">Talangan kasir yang belum diganti</Sel>
                  <Sel kanan tebal className="text-boom-600">
                    {rupiah(d.pengembalian.belum_diganti)}
                  </Sel>
                </tr>
              </Tabel>
            </Bagian>
          )}

          {d.gagal.length > 0 && (
            <Bagian
              judul="Transaksi dibatalkan"
              keterangan="Uangnya tidak ikut dihitung. Nomornya sengaja tidak dipakai ulang."
            >
              <Tabel
                kepala={['Nomor', 'Waktu', 'Dibatalkan oleh', 'Nilai belanja', 'Alasan']}
                rata={[null, null, null, 'kanan', null]}
              >
                {d.gagal.map((t) => (
                  <tr key={t.nomor}>
                    <Sel tebal className="angka whitespace-nowrap">{t.nomor}</Sel>
                    <Sel className="whitespace-nowrap text-coklat-400">
                      {tanggalPanjang(t.dibuat_pada)}, {jam(t.dibuat_pada)}
                    </Sel>
                    <Sel>{t.nama_pembatal || t.nama_kasir}</Sel>
                    <Sel kanan>{rupiah(t.total)}</Sel>
                    <Sel className="text-coklat-400">{t.alasan_batal || '-'}</Sel>
                  </tr>
                ))}
              </Tabel>
            </Bagian>
          )}

          <Bagian
            judul="Daftar seluruh transaksi"
            keterangan={`${d.transaksi.length} transaksi berhasil`}
          >
            <Tabel
              kepala={['Nomor', 'Jam', 'Kasir', 'Pembeli', 'Barang', 'Diskon', 'Uang masuk']}
              rata={[null, null, null, null, 'kanan', 'kanan', 'kanan']}
            >
              {d.transaksi.map((t) => (
                <tr key={t.nomor}>
                  <Sel tebal className="angka whitespace-nowrap">{t.nomor}</Sel>
                  <Sel className="angka whitespace-nowrap text-coklat-400">
                    {jam(t.dikonfirmasi_pada)}
                  </Sel>
                  <Sel>{t.nama_kasir}</Sel>
                  <Sel className="text-coklat-400">{t.nama_pembeli || '-'}</Sel>
                  <Sel kanan>{angka(t.jumlah_barang)}</Sel>
                  <Sel kanan className={t.diskon_rupiah > 0 ? 'text-daun-700' : 'text-netral-300'}>
                    {t.diskon_rupiah > 0 ? rupiah(t.diskon_rupiah) : '-'}
                  </Sel>
                  <Sel kanan tebal>{rupiah(t.uang_masuk)}</Sel>
                </tr>
              ))}
              <tr className="border-t-2 border-boom-500 bg-biji-100">
                <Sel tebal>TOTAL</Sel>
                <Sel />
                <Sel />
                <Sel />
                <Sel kanan tebal>
                  {angka(d.transaksi.reduce((a, t) => a + t.jumlah_barang, 0))}
                </Sel>
                <Sel kanan tebal className="text-daun-700">
                  {rupiah(d.transaksi.reduce((a, t) => a + t.diskon_rupiah, 0))}
                </Sel>
                <Sel kanan tebal className="text-boom-600">
                  {rupiah(d.ringkasan.total_uang_masuk)}
                </Sel>
              </tr>
            </Tabel>
          </Bagian>

          <p className="hanya-saat-cetak text-center text-xs text-coklat-400">
            Aplikasi Kasir Boomboo &middot; dicetak {tanggalPanjang(d.dibuat_pada)},{' '}
            {jam(d.dibuat_pada)}
          </p>
        </div>
      )}
    </div>
  );
}
