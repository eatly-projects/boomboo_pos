import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuQrCode, LuBanknote, LuArrowLeft, LuCircleCheck, LuTriangleAlert,
  LuSend, LuSkipForward, LuImageOff,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { useKeranjang } from '../kasir.store';
import { rupiah, nomorWaTampil } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, InputRupiah, Kolom } from '@/shared/components/ui/input';
import { Rangka, Pemberitahuan } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

/* ---------------------------------------------------------------- */
/* Langkah 1: memilih cara bayar                                     */
/* ---------------------------------------------------------------- */

function PilihanCaraBayar({ metode, setMetode }) {
  const pilihan = [
    { nilai: 'qris', label: 'QRIS', ikon: LuQrCode, keterangan: 'Pembeli memindai kode' },
    { nilai: 'tunai', label: 'Tunai', ikon: LuBanknote, keterangan: 'Bayar pakai uang kertas' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {pilihan.map((p) => (
        <button
          key={p.nilai}
          type="button"
          onClick={() => setMetode(p.nilai)}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 transition-all active:scale-[0.98]',
            metode === p.nilai
              ? 'border-boom-500 bg-boom-50'
              : 'border-netral-200 bg-white hover:border-coklat-200'
          )}
        >
          <p.ikon
            className={cn('size-7', metode === p.nilai ? 'text-boom-600' : 'text-coklat-400')}
          />
          <span className="font-bold text-coklat-900">{p.label}</span>
          <span className="text-center text-xs text-coklat-400">{p.keterangan}</span>
        </button>
      ))}
    </div>
  );
}

function LayarQris({ total, gambarQris }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-netral-200 bg-white p-5 text-center">
        <p className="text-sm font-semibold text-coklat-400">Minta pembeli membayar</p>
        <p className="angka mt-1 text-4xl font-extrabold tracking-tight text-boom-600 sm:text-5xl">
          {rupiah(total)}
        </p>
      </div>

      <div className="rounded-2xl border-2 border-netral-200 bg-white p-4">
        {gambarQris ? (
          <img
            src={gambarQris}
            alt="Kode QRIS Boomboo"
            className="mx-auto w-full max-w-xs rounded-xl"
          />
        ) : (
          <div className="grid aspect-square w-full max-w-xs place-items-center gap-2 rounded-xl border-2 border-dashed border-netral-300 p-6 text-center mx-auto">
            <LuImageOff className="size-9 text-coklat-200" />
            <p className="text-sm font-bold text-coklat-900">Gambar QRIS belum diunggah</p>
            <p className="text-xs text-coklat-400">
              Unggah dulu di halaman Pengaturan, atau pakai QRIS yang ditempel di meja kasir.
            </p>
          </div>
        )}
      </div>

      <Pemberitahuan warna="kuning" ikon={LuTriangleAlert} judul="Periksa dulu sebelum konfirmasi">
        Kode QRIS ini tidak mengunci nominal, jadi pembeli mengetik sendiri jumlahnya.
        Cocokkan angka di bukti bayar pembeli dengan{' '}
        <span className="angka font-bold text-coklat-900">{rupiah(total)}</span> di atas.
      </Pemberitahuan>
    </div>
  );
}

function LayarTunai({ total, uang, setUang }) {
  const kembalian = uang === '' ? null : Number(uang) - total;
  const kurang = kembalian !== null && kembalian < 0;

  // Pilihan cepat: uang pas, lalu pembulatan ke atas yang masuk akal
  const cepat = useMemo(() => {
    const angka = new Set([total]);
    for (const kelipatan of [5000, 10000, 50000, 100000]) {
      const bulat = Math.ceil(total / kelipatan) * kelipatan;
      if (bulat >= total) angka.add(bulat);
    }
    return [...angka].sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-netral-200 bg-white p-5 text-center">
        <p className="text-sm font-semibold text-coklat-400">Total yang harus dibayar</p>
        <p className="angka mt-1 text-4xl font-extrabold tracking-tight text-boom-600 sm:text-5xl">
          {rupiah(total)}
        </p>
      </div>

      <div className="rounded-2xl border-2 border-netral-200 bg-white p-4">
        <Kolom label="Uang yang diterima dari pembeli" wajib>
          <InputRupiah
            autoFocus
            placeholder="Contoh: 100000"
            value={uang}
            onChange={setUang}
            className="h-14 text-center text-2xl font-extrabold"
          />
        </Kolom>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cepat.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setUang(n)}
              className="angka rounded-xl border-2 border-netral-200 py-2.5 text-sm font-bold text-coklat-900 transition-colors hover:border-boom-500 hover:text-boom-600"
            >
              {n === total ? 'Uang pas' : rupiah(n)}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          'rounded-2xl border-2 p-5 text-center',
          kurang ? 'border-boom-200 bg-boom-50' : 'border-daun-300 bg-daun-50'
        )}
      >
        <p className="text-sm font-semibold text-coklat-600">
          {kurang ? 'Uangnya masih kurang' : 'Kembalian untuk pembeli'}
        </p>
        <p
          className={cn(
            'angka mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl',
            kurang ? 'text-boom-600' : 'text-daun-700'
          )}
        >
          {kembalian === null ? '-' : rupiah(Math.abs(kembalian))}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Langkah 2: data pembeli untuk struk WhatsApp                      */
/* ---------------------------------------------------------------- */

function FormPembeli({ transaksi, onSelesai }) {
  const [nama, setNama] = useState('');
  const [nomor, setNomor] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);

  async function simpan() {
    if (!nomor.trim()) return toast.error('Nomor WhatsApp belum diisi.');
    setSedangKirim(true);
    try {
      await denganToast(
        () => api.patch(`/transaksi/${transaksi.id}/pembeli`, {
          nama_pembeli: nama.trim() || null,
          nomor_wa: nomor.trim(),
        }),
        { memuat: 'Menyimpan data pembeli...', sukses: 'Struk masuk antrian kirim.' }
      );
      onSelesai();
    } catch {
      setSedangKirim(false);
    }
  }

  async function lewati() {
    setSedangKirim(true);
    try {
      await api.post(`/transaksi/${transaksi.id}/lewati-struk`);
      onSelesai();
    } catch {
      setSedangKirim(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-daun-300 bg-daun-50 p-5 text-center">
        <LuCircleCheck className="mx-auto size-10 text-daun-700" />
        <p className="mt-2 text-lg font-extrabold text-coklat-900">Pembayaran berhasil</p>
        <p className="angka mt-0.5 text-sm text-coklat-600">
          {transaksi.nomor} &middot; {rupiah(transaksi.total)}
        </p>
        {transaksi.metode_bayar === 'tunai' && transaksi.kembalian > 0 && (
          <p className="angka mt-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-coklat-900">
            Kembalian: {rupiah(transaksi.kembalian)}
          </p>
        )}
      </div>

      {transaksi.ditandai_stok_kurang && (
        <Pemberitahuan warna="merah" ikon={LuTriangleAlert} judul="Stok jadi kurang">
          Ada produk yang stoknya keburu habis diambil kasir lain. Transaksinya tetap
          diteruskan karena uangnya sudah masuk, tapi tolong segera periksa stok fisiknya.
        </Pemberitahuan>
      )}

      <div className="rounded-2xl border-2 border-netral-200 bg-white p-4">
        <p className="font-bold text-coklat-900">Kirim struk lewat WhatsApp</p>
        <p className="mt-0.5 text-sm text-coklat-400">
          Tanyakan nama dan nomor WhatsApp pembeli. Boleh dilewati kalau pembeli keberatan.
        </p>

        <div className="mt-4 space-y-3">
          <Kolom label="Nama pembeli" bantuan="Boleh dikosongkan.">
            <Input
              placeholder="Contoh: Sari"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
            />
          </Kolom>

          <Kolom label="Nomor WhatsApp">
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="Contoh: 081234567890"
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
            />
          </Kolom>

          <p className="rounded-xl bg-coklat-50 px-3 py-2.5 text-xs text-coklat-600">
            Nomor Anda kami simpan untuk mengirim struk dan informasi promo Boomboo.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button ukuran="besar" className="flex-1" onClick={simpan} disabled={sedangKirim}>
            <LuSend />
            Simpan & kirim struk
          </Button>
          <Button
            variant="garis"
            ukuran="besar"
            className="sm:w-40"
            onClick={lewati}
            disabled={sedangKirim}
          >
            <LuSkipForward />
            Lewati
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Halaman                                                           */
/* ---------------------------------------------------------------- */

export default function Pembayaran() {
  const { id } = useParams();
  const navigate = useNavigate();
  const klien = useQueryClient();
  const kosongkanKeranjang = useKeranjang((s) => s.kosongkan);

  const [metode, setMetode] = useState('qris');
  const [uang, setUang] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);
  const [sudahDibayar, setSudahDibayar] = useState(null);

  const transaksi = useQuery({
    queryKey: ['transaksi', id],
    queryFn: () => ambil(`/transaksi/${id}`),
  });

  const pengaturan = useQuery({
    queryKey: ['pengaturan'],
    queryFn: () => ambil('/pengaturan'),
  });

  // Keranjang dikosongkan begitu transaksinya sudah tercatat di server,
  // supaya kasir tidak sengaja mengirim keranjang yang sama dua kali.
  useEffect(() => {
    if (transaksi.data) kosongkanKeranjang();
  }, [transaksi.data, kosongkanKeranjang]);

  async function konfirmasi() {
    const t = transaksi.data;
    if (metode === 'tunai') {
      if (uang === '') return toast.error('Isi dulu uang yang diterima dari pembeli.');
      if (Number(uang) < t.total) return toast.error('Uang yang diterima masih kurang.');
    }

    setSedangKirim(true);
    try {
      const hasil = await denganToast(
        () => api.post(`/transaksi/${id}/konfirmasi`, {
          metode_bayar: metode,
          uang_diterima: metode === 'tunai' ? Number(uang) : null,
        }),
        { memuat: 'Mengonfirmasi pembayaran...', sukses: (d) => d.pesan }
      );
      // Semua daftar yang ikut berubah disegarkan, supaya transaksi yang
      // baru saja dibuat langsung muncul di halaman Transaksi dan Stok.
      ['produk', 'dashboard', 'transaksi', 'stok', 'antrian-struk'].forEach((k) =>
        klien.invalidateQueries({ queryKey: [k] })
      );
      setSudahDibayar(hasil.data);
    } catch {
      setSedangKirim(false);
    }
  }

  async function batalkan() {
    setSedangKirim(true);
    try {
      await denganToast(
        () => api.post(`/transaksi/${id}/batal`, { alasan: 'Dibatalkan dari layar pembayaran' }),
        { memuat: 'Membatalkan...', sukses: 'Transaksi dibatalkan.' }
      );
      ['produk', 'dashboard', 'transaksi', 'stok'].forEach((k) =>
        klien.invalidateQueries({ queryKey: [k] })
      );
      navigate('/kasir');
    } catch {
      setSedangKirim(false);
    }
  }

  if (transaksi.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Rangka className="h-8 w-40" />
        <Rangka className="h-32 w-full" />
        <Rangka className="h-64 w-full" />
      </div>
    );
  }

  if (transaksi.isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <Pemberitahuan warna="merah" ikon={LuTriangleAlert} judul="Transaksi tidak ditemukan">
          Transaksi ini mungkin sudah dihapus atau alamatnya salah.
        </Pemberitahuan>
        <Button className="mt-4" onClick={() => navigate('/kasir')}>
          <LuArrowLeft /> Kembali ke kasir
        </Button>
      </div>
    );
  }

  const t = transaksi.data;

  // Langkah 2: sudah dibayar, tinggal isi data pembeli
  if (sudahDibayar) {
    return (
      <div className="mx-auto max-w-2xl">
        <FormPembeli
          transaksi={sudahDibayar}
          onSelesai={() => {
            ['antrian-struk', 'transaksi', 'kontak'].forEach((k) =>
              klien.invalidateQueries({ queryKey: [k] })
            );
            navigate('/kasir');
          }}
        />
      </div>
    );
  }

  // Transaksi yang sudah tidak menunggu pembayaran
  if (t.status !== 'menunggu_pembayaran') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Pemberitahuan
          warna={t.status === 'selesai' ? 'hijau' : 'netral'}
          ikon={LuCircleCheck}
          judul={t.status === 'selesai' ? 'Transaksi ini sudah selesai' : 'Transaksi ini sudah dibatalkan'}
        >
          Nomor {t.nomor} &middot; {rupiah(t.total)}
        </Pemberitahuan>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/kasir')}>
            <LuArrowLeft /> Kembali ke kasir
          </Button>
          <Button variant="garis" onClick={() => navigate(`/transaksi/${t.id}`)}>
            Lihat rincian
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-coklat-400">Nomor transaksi</p>
          <p className="angka truncate text-lg font-extrabold text-coklat-900">{t.nomor}</p>
        </div>
        <Button variant="polos" onClick={() => navigate('/kasir')}>
          <LuArrowLeft /> Kasir
        </Button>
      </div>

      {/* Rincian singkat belanjaan */}
      <div className="mb-4 rounded-2xl border-2 border-netral-200 bg-white p-4">
        <div className="space-y-1.5 text-sm">
          {t.item.map((i) => (
            <div key={i.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-coklat-600">
                <span className="angka font-bold text-coklat-900">{i.jumlah}x</span> {i.nama_barang}
              </span>
              <span className="angka shrink-0 font-semibold text-coklat-900">
                {rupiah(i.subtotal)}
              </span>
            </div>
          ))}
          {t.diskon_rupiah > 0 && (
            <div className="flex justify-between border-t-2 border-netral-200 pt-1.5 text-daun-700">
              <span>
                Diskon {t.diskon_jenis === 'persen' ? `${t.diskon_nilai}%` : 'potongan'}
              </span>
              <span className="angka font-semibold">- {rupiah(t.diskon_rupiah)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <PilihanCaraBayar metode={metode} setMetode={setMetode} />
      </div>

      {metode === 'qris' ? (
        <LayarQris total={t.total} gambarQris={pengaturan.data?.qris_gambar_url} />
      ) : (
        <LayarTunai total={t.total} uang={uang} setUang={setUang} />
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          ukuran="besar"
          variant="hijau"
          className="flex-1"
          onClick={konfirmasi}
          disabled={sedangKirim}
        >
          <LuCircleCheck />
          {sedangKirim ? 'Memproses...' : 'Konfirmasi pembayaran'}
        </Button>
        <Button
          ukuran="besar"
          variant="bahaya"
          className="sm:w-48"
          onClick={batalkan}
          disabled={sedangKirim}
        >
          Batalkan transaksi
        </Button>
      </div>

      <p className="mt-3 text-center text-xs text-coklat-400">
        Stok baru berkurang setelah tombol konfirmasi ditekan.
      </p>
    </div>
  );
}
