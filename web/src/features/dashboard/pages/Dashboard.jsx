import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  LuQrCode, LuBanknote, LuWallet, LuReceipt, LuTriangleAlert, LuSend,
  LuTrendingUp, LuPackage, LuTicketPercent, LuCalendarRange,
} from 'react-icons/lu';
import { ambil } from '@/shared/lib/api';
import {
  rupiah, angka, keIsoTanggal, tanggalPendek, rentangTanggal, tanggalPanjang,
} from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, Kolom } from '@/shared/components/ui/input';
import {
  KepalaHalaman, Rangka, RangkaKartu, KotakAngka, Kosong, Pemberitahuan,
} from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

const hariLalu = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return keIsoTanggal(d);
};

const PINTASAN = [
  { label: 'Hari ini', dari: () => keIsoTanggal(new Date()), sampai: () => keIsoTanggal(new Date()) },
  { label: '7 hari terakhir', dari: () => hariLalu(6), sampai: () => keIsoTanggal(new Date()) },
  { label: '30 hari terakhir', dari: () => hariLalu(29), sampai: () => keIsoTanggal(new Date()) },
  { label: 'Semua waktu', dari: () => '', sampai: () => '' },
];

function PetunjukGrafik({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border-2 border-netral-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-bold text-coklat-900">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="angka text-xs text-coklat-600">
          <span
            className="mr-1.5 inline-block size-2 rounded-sm align-middle"
            style={{ background: p.color }}
          />
          {p.name}: <span className="font-bold text-coklat-900">{rupiah(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [rentang, setRentang] = useState({ dari: hariLalu(6), sampai: keIsoTanggal(new Date()) });

  const params = {
    ...(rentang.dari ? { tanggal_dari: rentang.dari } : {}),
    ...(rentang.sampai ? { tanggal_sampai: rentang.sampai } : {}),
  };

  const data = useQuery({
    queryKey: ['dashboard', params],
    queryFn: () => ambil('/dashboard', { params }),
  });

  const d = data.data;
  const r = d?.ringkasan;
  const sorotan = d?.sorotan;

  const grafik = (d?.harian || []).map((h) => ({
    tanggal: tanggalPendek(h.tanggal),
    QRIS: h.qris,
    Tunai: h.tunai,
    total: h.total,
    jumlah: h.jumlah_transaksi,
  }));

  const hariTerbaik = (d?.harian || []).reduce(
    (a, b) => (!a || b.total > a.total ? b : a),
    null
  );

  return (
    <div>
      <KepalaHalaman
        judul="Dashboard"
        keterangan={rentangTanggal(rentang.dari, rentang.sampai)}
      />

      {/* Penyaring waktu */}
      <div className="mb-5 rounded-2xl border-2 border-netral-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PINTASAN.map((p) => {
            const aktif = rentang.dari === p.dari() && rentang.sampai === p.sampai();
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setRentang({ dari: p.dari(), sampai: p.sampai() })}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-bold transition-colors',
                  aktif
                    ? 'bg-boom-500 text-white'
                    : 'bg-netral-100 text-coklat-600 hover:bg-coklat-50'
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Kolom label="Tanggal mulai">
            <Input
              type="date"
              max={keIsoTanggal(new Date())}
              value={rentang.dari}
              onChange={(e) => setRentang((s) => ({ ...s, dari: e.target.value }))}
            />
          </Kolom>
          <Kolom label="Tanggal akhir">
            <Input
              type="date"
              max={keIsoTanggal(new Date())}
              value={rentang.sampai}
              onChange={(e) => setRentang((s) => ({ ...s, sampai: e.target.value }))}
            />
          </Kolom>
        </div>
      </div>

      {/* Pemberitahuan yang butuh tindakan */}
      {sorotan?.struk_belum_terkirim > 0 && (
        <Pemberitahuan warna="kuning" className="mb-4" ikon={LuSend} judul="Ada struk yang belum dikirim">
          <span className="angka font-bold">{sorotan.struk_belum_terkirim} struk</span> menunggu
          dikirim ke WhatsApp pembeli.{' '}
          <Link to="/antrian-struk" className="font-bold text-coklat-900 underline">
            Buka antrian kirim struk
          </Link>
        </Pemberitahuan>
      )}

      {r?.transaksi_stok_kurang > 0 && (
        <Pemberitahuan warna="merah" className="mb-4" ikon={LuTriangleAlert} judul="Ada transaksi dengan stok kurang">
          <span className="angka font-bold">{r.transaksi_stok_kurang} transaksi</span> diloloskan
          walaupun stoknya tidak mencukupi, karena uang pembeli sudah masuk. Sebaiknya stok
          fisiknya dihitung ulang.
        </Pemberitahuan>
      )}

      {/* Uang masuk */}
      <p className="mb-2.5 text-sm font-bold uppercase tracking-wide text-coklat-400">
        Uang masuk
      </p>

      {data.isLoading ? (
        <RangkaKartu jumlah={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KotakAngka
            judul="Total uang masuk"
            nilai={rupiah(r.total_uang_masuk)}
            keterangan={`Dari ${angka(r.jumlah_transaksi)} transaksi selesai`}
            ikon={LuWallet}
            warna="hijau"
          />
          <KotakAngka
            judul="Uang masuk lewat QRIS"
            nilai={rupiah(r.uang_qris)}
            keterangan={`${angka(r.jumlah_qris)} transaksi`}
            ikon={LuQrCode}
            warna="merah"
          />
          <KotakAngka
            judul="Uang masuk tunai"
            nilai={rupiah(r.uang_tunai)}
            keterangan={`${angka(r.jumlah_tunai)} transaksi`}
            ikon={LuBanknote}
            warna="kuning"
          />
          <KotakAngka
            judul="Rata-rata per transaksi"
            nilai={rupiah(r.rata_rata_per_transaksi)}
            keterangan="Total dibagi jumlah transaksi"
            ikon={LuTrendingUp}
          />
        </div>
      )}

      {/* Angka pendukung */}
      {!data.isLoading && r && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KotakAngka
            judul="Total diskon diberikan"
            nilai={rupiah(r.total_diskon)}
            keterangan={`Dari penjualan kotor ${rupiah(r.total_sebelum_diskon)}`}
            ikon={LuTicketPercent}
          />
          <KotakAngka
            judul="Transaksi dibatalkan"
            nilai={angka(r.jumlah_batal)}
            keterangan="Tidak dihitung sebagai uang masuk"
            ikon={LuReceipt}
            warna={r.jumlah_batal > 0 ? 'kuning' : 'netral'}
          />
          <KotakAngka
            judul="Produk stoknya habis"
            nilai={angka(sorotan?.produk_habis ?? 0)}
            keterangan={`Dari ${angka(sorotan?.jumlah_produk ?? 0)} produk`}
            ikon={LuPackage}
            warna={sorotan?.produk_habis > 0 ? 'merah' : 'netral'}
          />
          <KotakAngka
            judul="Hari paling ramai"
            nilai={hariTerbaik ? tanggalPendek(hariTerbaik.tanggal) : '-'}
            keterangan={hariTerbaik ? rupiah(hariTerbaik.total) : 'Belum ada data'}
            ikon={LuCalendarRange}
          />
        </div>
      )}

      {/* Grafik perbandingan harian */}
      <div className="mt-5 rounded-2xl border-2 border-netral-200 bg-white p-4 sm:p-5">
        <p className="font-bold text-coklat-900">Penjualan hari per hari</p>
        <p className="mb-4 text-sm text-coklat-400">
          Batang merah untuk QRIS, batang kuning untuk tunai.
        </p>

        {data.isLoading ? (
          <Rangka className="h-72 w-full rounded-xl" />
        ) : grafik.length === 0 ? (
          <Kosong
            ikon={LuCalendarRange}
            judul="Belum ada penjualan"
            keterangan="Tidak ada transaksi selesai pada rentang tanggal yang dipilih."
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafik} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e7" vertical={false} />
                <XAxis
                  dataKey="tanggal"
                  tick={{ fontSize: 11, fill: '#8a6d5d' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e8e8e7' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#8a6d5d' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000} jt` : `${v / 1000} rb`)}
                />
                <Tooltip content={<PetunjukGrafik />} cursor={{ fill: '#f5f5f4' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="QRIS" stackId="a" fill="#e43222" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Tunai" stackId="a" fill="#f3db9f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Terlaris & per kasir */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border-2 border-netral-200 bg-white p-4 sm:p-5">
          <p className="mb-3 font-bold text-coklat-900">Barang paling laris</p>

          {data.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Rangka key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (d?.terlaris || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-coklat-400">Belum ada penjualan.</p>
          ) : (
            <div className="space-y-1">
              {d.terlaris.map((t, i) => (
                <div key={t.nama_barang} className="flex items-center gap-3 py-2">
                  <span className="angka grid size-7 shrink-0 place-items-center rounded-lg bg-coklat-50 text-xs font-bold text-coklat-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-coklat-900">{t.nama_barang}</p>
                    <p className="angka text-xs text-coklat-400">
                      {t.jenis_barang === 'produk' ? 'Produk' : 'Menu makan'} &middot; terjual{' '}
                      {angka(t.jumlah_terjual)}
                    </p>
                  </div>
                  <p className="angka shrink-0 text-sm font-extrabold text-coklat-900">
                    {rupiah(t.total_penjualan)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border-2 border-netral-200 bg-white p-4 sm:p-5">
          <p className="mb-3 font-bold text-coklat-900">Penjualan per kasir</p>

          {data.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Rangka key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (d?.per_kasir || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-coklat-400">Belum ada penjualan.</p>
          ) : (
            <div className="space-y-1">
              {d.per_kasir.map((k) => (
                <div key={k.nama_kasir} className="flex items-center gap-3 py-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-boom-50 text-sm font-bold text-boom-600">
                    {k.nama_kasir.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-coklat-900">{k.nama_kasir}</p>
                    <p className="angka text-xs text-coklat-400">
                      {angka(k.jumlah_transaksi)} transaksi &middot; QRIS {rupiah(k.qris)} &middot;
                      Tunai {rupiah(k.tunai)}
                    </p>
                  </div>
                  <p className="angka shrink-0 text-sm font-extrabold text-coklat-900">
                    {rupiah(k.total)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
