import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuQrCode, LuArrowLeft, LuCircleCheck, LuTriangleAlert,
  LuSend, LuSkipForward, LuImageOff, LuNotebookPen,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { useKeranjang } from '../kasir.store';
import { rupiah } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, Kolom } from '@/shared/components/ui/input';
import { Rangka, Pemberitahuan } from '@/shared/components/ui/tampilan';

/* ---------------------------------------------------------------- */
/* Langkah 1: bayar lewat QRIS                                       */
/* ---------------------------------------------------------------- */

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
          <div className="mx-auto grid aspect-square w-full max-w-xs place-items-center gap-2 rounded-xl border-2 border-dashed border-netral-300 p-6 text-center">
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

/* ---------------------------------------------------------------- */
/* Langkah 2: data pembeli untuk struk WhatsApp                      */
/* ---------------------------------------------------------------- */

function FormPembeli({ transaksi, onSelesai }) {
  // Kalau transaksinya berasal dari Open Bill, nama dan nomornya sudah
  // diisi sejak bill dibuka, jadi kasir tidak perlu menanyakannya lagi.
  const sudahAda = Boolean(transaksi.nomor_wa);

  const [nama, setNama] = useState(transaksi.nama_pembeli || '');
  const [nomor, setNomor] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);

  async function simpan() {
    if (!nomor.trim()) return toast.error('Nomor WhatsApp belum diisi.');
    setSedangKirim(true);
    try {
      await denganToast(
        () =>
          api.patch(`/transaksi/${transaksi.id}/pembeli`, {
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
      </div>

      {transaksi.ditandai_stok_kurang && (
        <Pemberitahuan warna="merah" ikon={LuTriangleAlert} judul="Stok jadi kurang">
          Ada produk yang stoknya keburu habis diambil kasir lain. Transaksinya tetap
          diteruskan karena uangnya sudah masuk, tapi tolong segera periksa stok fisiknya.
        </Pemberitahuan>
      )}

      {sudahAda ? (
        <div className="rounded-2xl border-2 border-netral-200 bg-white p-4 text-center">
          <LuSend className="mx-auto size-7 text-daun-700" />
          <p className="mt-2 font-bold text-coklat-900">Struk sudah masuk antrian kirim</p>
          <p className="mt-0.5 text-sm text-coklat-400">
            Nama dan nomor WhatsApp sudah diisi sejak bill dibuka, jadi tidak perlu ditanya lagi.
          </p>
          <Button ukuran="besar" className="mt-4 w-full" onClick={onSelesai}>
            Selesai
          </Button>
        </div>
      ) : (
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
            <Button ukuran="besar" className="sm:flex-1" onClick={simpan} disabled={sedangKirim}>
              <LuSend />
              Simpan &amp; kirim struk
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
      )}
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

  useEffect(() => {
    if (transaksi.data) kosongkanKeranjang();
  }, [transaksi.data, kosongkanKeranjang]);

  const segarkan = () =>
    ['produk', 'menu', 'dashboard', 'transaksi', 'stok', 'antrian-struk', 'bill'].forEach((k) =>
      klien.invalidateQueries({ queryKey: [k] })
    );

  async function konfirmasi() {
    setSedangKirim(true);
    try {
      const hasil = await denganToast(() => api.post(`/transaksi/${id}/konfirmasi`, {}), {
        memuat: 'Mengonfirmasi pembayaran...',
        sukses: (d) => d.pesan,
      });
      segarkan();
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
      segarkan();
      navigate('/kasir');
    } catch {
      setSedangKirim(false);
    }
  }

  if (transaksi.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Rangka className="h-8 w-40" />
        <Rangka className="h-32 w-full rounded-2xl" />
        <Rangka className="h-64 w-full rounded-2xl" />
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

  if (sudahDibayar) {
    return (
      <div className="mx-auto max-w-2xl">
        <FormPembeli
          transaksi={sudahDibayar}
          onSelesai={() => {
            segarkan();
            navigate(t.bill_id ? '/bill' : '/kasir');
          }}
        />
      </div>
    );
  }

  if (t.status !== 'menunggu_pembayaran') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Pemberitahuan
          warna={t.status === 'selesai' ? 'hijau' : 'netral'}
          ikon={LuCircleCheck}
          judul={
            t.status === 'selesai'
              ? 'Transaksi ini sudah selesai'
              : t.status === 'ditukar'
                ? 'Transaksi ini sudah ditukar'
                : 'Transaksi ini sudah dibatalkan'
          }
        >
          Nomor {t.nomor} &middot; {rupiah(t.total)}
        </Pemberitahuan>
        <div className="flex flex-wrap gap-2">
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
        <Button variant="polos" onClick={() => navigate(t.bill_id ? '/bill' : '/kasir')}>
          <LuArrowLeft /> {t.bill_id ? 'Open Bill' : 'Kasir'}
        </Button>
      </div>

      {t.bill_id && (
        <Pemberitahuan warna="netral" className="mb-4" ikon={LuNotebookPen}>
          Transaksi ini berasal dari Open Bill atas nama{' '}
          <strong>{t.nama_pembeli}</strong>. Stok barangnya sudah berkurang sejak dipesan, jadi
          konfirmasi di sini hanya mencatat pembayarannya.
        </Pemberitahuan>
      )}

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
              <span>Diskon {t.diskon_jenis === 'persen' ? `${t.diskon_nilai}%` : 'potongan'}</span>
              <span className="angka font-semibold">- {rupiah(t.diskon_rupiah)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-2xl border-2 border-boom-200 bg-boom-50 px-4 py-3">
        <LuQrCode className="size-5 shrink-0 text-boom-600" />
        <p className="text-sm font-bold text-coklat-900">
          Pembayaran lewat QRIS
          <span className="ml-1 font-normal text-coklat-600">— satu-satunya cara bayar</span>
        </p>
      </div>

      <LayarQris total={t.total} gambarQris={pengaturan.data?.qris_gambar_url} />

      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          ukuran="besar"
          variant="hijau"
          className="sm:flex-1"
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
        {t.bill_id
          ? 'Stok sudah berkurang sejak barang dimasukkan ke bill.'
          : 'Stok baru berkurang setelah tombol konfirmasi ditekan.'}
      </p>
    </div>
  );
}
