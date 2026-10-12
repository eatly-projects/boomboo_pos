import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuQrCode, LuArrowLeft, LuCircleCheck, LuTriangleAlert,
  LuSend, LuSkipForward, LuImageOff, LuNotebookPen, LuUserCheck,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { useKeranjang } from '../kasir.store';
import { rupiah, nomorWaTampil } from '@/shared/lib/format';
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

/**
 * Saran pembeli yang nomornya sudah pernah dicatat.
 *
 * Sengaja berupa daftar yang HARUS diketuk, bukan terisi otomatis. Kasir yang
 * sedang buru-buru gampang tidak sadar kalau kolomnya terisi sendiri, dan
 * struk bisa terkirim ke orang yang salah - kesalahan yang baru ketahuan
 * setelah pembelinya komplain.
 *
 * Pencarian baru jalan setelah 3 huruf/angka, dan ditunda sebentar supaya
 * tidak menembak server tiap ketukan tombol.
 */
function SaranPembeli({ kata, onPilih }) {
  const [tertunda, setTertunda] = useState('');

  useEffect(() => {
    const jeda = setTimeout(() => setTertunda(kata.trim()), 300);
    return () => clearTimeout(jeda);
  }, [kata]);

  const cukup = tertunda.length >= 3;
  const hasil = useQuery({
    queryKey: ['kontak', 'saran', tertunda],
    queryFn: () => ambil('/struk/kontak', { params: { cari: tertunda, per_halaman: 6 } }),
    enabled: cukup,
    staleTime: 60_000,
  });

  const daftar = hasil.data?.daftar || [];
  if (!cukup || daftar.length === 0) return null;

  return (
    <div className="mt-2 overflow-hidden rounded-xl border-2 border-daun-300 bg-daun-50">
      <p className="flex items-center gap-1.5 border-b border-daun-300 px-3 py-2 text-xs font-bold text-daun-700">
        <LuUserCheck className="size-3.5" />
        Pembeli ini sudah pernah dicatat, ketuk untuk memakainya
      </p>
      <div className="divide-y divide-daun-300">
        {daftar.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => onPilih(k)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-daun-100"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-coklat-900">
                {k.nama || 'Tanpa nama'}
              </span>
              <span className="angka block text-xs text-coklat-600">
                {nomorWaTampil(k.nomor)}
              </span>
            </span>
            <span className="angka shrink-0 text-right text-xs text-coklat-400">
              {k.jumlah_transaksi}x belanja
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FormPembeli({ transaksi, onSelesai }) {
  // Kalau transaksinya berasal dari Open Bill, nama dan nomornya sudah
  // diisi sejak bill dibuka, jadi kasir tidak perlu menanyakannya lagi.
  const sudahAda = Boolean(transaksi.nomor_wa);

  const [nama, setNama] = useState(transaksi.nama_pembeli || '');
  const [nomor, setNomor] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);
  // Kolom mana yang sedang diketik, supaya sarannya muncul di bawah kolom itu
  // saja - bukan dua-duanya sekaligus.
  const [kolomAktif, setKolomAktif] = useState(null);
  const [dariKontak, setDariKontak] = useState(null);

  function pakaiKontak(k) {
    setNama(k.nama || '');
    setNomor(k.nomor);
    setDariKontak(k);
    setKolomAktif(null);
  }

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
            <div>
              <Kolom label="Nama pembeli" bantuan="Boleh dikosongkan.">
                <Input
                  placeholder="Contoh: Sari"
                  value={nama}
                  onChange={(e) => {
                    setNama(e.target.value);
                    setDariKontak(null);
                    setKolomAktif('nama');
                  }}
                  onFocus={() => setKolomAktif('nama')}
                />
              </Kolom>
              {kolomAktif === 'nama' && (
                <SaranPembeli kata={nama} onPilih={pakaiKontak} />
              )}
            </div>

            <div>
              <Kolom label="Nomor WhatsApp">
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Contoh: 081234567890"
                  value={nomor}
                  onChange={(e) => {
                    setNomor(e.target.value);
                    setDariKontak(null);
                    setKolomAktif('nomor');
                  }}
                  onFocus={() => setKolomAktif('nomor')}
                />
              </Kolom>
              {kolomAktif === 'nomor' && (
                <SaranPembeli kata={nomor} onPilih={pakaiKontak} />
              )}
            </div>

            {dariKontak ? (
              <p className="flex items-start gap-2 rounded-xl bg-daun-50 px-3 py-2.5 text-xs text-daun-700">
                <LuUserCheck className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Diambil dari pembeli yang sudah tercatat
                  {dariKontak.jumlah_transaksi > 0 && (
                    <> &middot; sudah {dariKontak.jumlah_transaksi} kali belanja</>
                  )}
                  . Tidak perlu diketik ulang.
                </span>
              </p>
            ) : (
              <p className="rounded-xl bg-coklat-50 px-3 py-2.5 text-xs text-coklat-600">
                Nomor Anda kami simpan untuk mengirim struk dan informasi promo Boomboo.
              </p>
            )}
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
