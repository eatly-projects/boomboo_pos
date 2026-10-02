import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuArrowLeft, LuMinus, LuPlus, LuSearch, LuX, LuRepeat, LuTriangleAlert,
  LuArrowDown, LuArrowUp, LuWallet, LuUser, LuTrash2,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { rupiah, tanggalJam } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, Kolom, Textarea } from '@/shared/components/ui/input';
import { Rangka, Pemberitahuan, Label, KepalaHalaman } from '@/shared/components/ui/tampilan';
import { cn } from '@/shared/lib/utils';

/**
 * Tukar barang untuk transaksi yang SUDAH dibayar.
 *
 * Aturan harganya: barang yang tetap memakai harga beku dari transaksi lama,
 * barang pengganti memakai harga yang berlaku hari ini. Selisihnya yang
 * dibayar atau dikembalikan.
 */
export default function TukarBarang() {
  const { id } = useParams();
  const navigate = useNavigate();
  const klien = useQueryClient();

  const [kembali, setKembali] = useState({});   // { transaksi_item_id: jumlah }
  const [pengganti, setPengganti] = useState([]); // [{ jenis, id, nama, harga, jumlah }]
  const [cari, setCari] = useState('');
  const [sumberDana, setSumberDana] = useState('kantor');
  const [catatan, setCatatan] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);

  const trx = useQuery({ queryKey: ['transaksi', id], queryFn: () => ambil(`/transaksi/${id}`) });
  const produk = useQuery({
    queryKey: ['produk', 'kasir'],
    queryFn: () => ambil('/produk', { params: { hanya_dijual_satuan: true } }),
  });
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => ambil('/menu') });

  const katalog = useMemo(() => {
    const semua = [
      ...(produk.data || []).map((p) => ({ ...p, _jenis: 'produk' })),
      ...(menu.data || []).map((m) => ({ ...m, _jenis: 'menu' })),
    ];
    const kata = cari.trim().toLowerCase();
    return kata ? semua.filter((b) => b.nama.toLowerCase().includes(kata)) : semua;
  }, [produk.data, menu.data, cari]);

  const t = trx.data;

  /* --- Hitungan uang --- */
  const hitung = useMemo(() => {
    if (!t) return null;
    const tetap = t.item.reduce(
      (total, i) => total + i.harga_dipakai * (i.jumlah - (kembali[i.id] || 0)),
      0
    );
    const baru = pengganti.reduce((total, p) => total + p.harga * p.jumlah, 0);
    const subtotal = tetap + baru;

    let potongan = 0;
    if (t.diskon_jenis && t.diskon_nilai > 0) {
      potongan =
        t.diskon_jenis === 'persen'
          ? Math.round((subtotal * t.diskon_nilai) / 100)
          : Math.min(t.diskon_nilai, subtotal);
    }
    const totalBaru = subtotal - potongan;
    return { tetap, baru, subtotal, potongan, totalBaru, selisih: totalBaru - t.total };
  }, [t, kembali, pengganti]);

  const adaYangDikembalikan = Object.values(kembali).some((n) => n > 0);

  function ubahKembali(itemId, maks, arah) {
    setKembali((s) => {
      const sekarang = s[itemId] || 0;
      const baru = Math.min(Math.max(sekarang + arah, 0), maks);
      return { ...s, [itemId]: baru };
    });
  }

  function tambahPengganti(brg, jenis) {
    const batas = jenis === 'produk' ? brg.stok : brg.sisa_porsi;
    setPengganti((s) => {
      const adaDi = s.findIndex((p) => p.id === brg.id && p.jenis === jenis);
      if (adaDi >= 0) {
        if (batas != null && s[adaDi].jumlah + 1 > batas) {
          toast.error(`Stok ${brg.nama} tidak cukup.`);
          return s;
        }
        const salinan = [...s];
        salinan[adaDi] = { ...salinan[adaDi], jumlah: salinan[adaDi].jumlah + 1 };
        return salinan;
      }
      if (batas != null && batas < 1) {
        toast.error(`Stok ${brg.nama} habis.`);
        return s;
      }
      return [
        ...s,
        {
          jenis,
          id: brg.id,
          nama: brg.nama,
          harga: brg.harga_diskon ?? brg.harga,
          nama_diskon: brg.nama_diskon,
          jumlah: 1,
          batas,
        },
      ];
    });
  }

  async function kirim() {
    if (!adaYangDikembalikan)
      return toast.error('Pilih dulu barang mana yang dikembalikan pembeli.');
    if (hitung.selisih < 0 && !sumberDana)
      return toast.error('Pilih dulu sumber uang kembaliannya.');

    setSedangKirim(true);
    try {
      const hasil = await denganToast(
        () =>
          api.post(`/transaksi/${id}/tukar`, {
            dikembalikan: Object.entries(kembali)
              .filter(([, n]) => n > 0)
              .map(([item_id, jumlah]) => ({ item_id, jumlah })),
            pengganti: pengganti.map((p) => ({
              jenis_barang: p.jenis,
              barang_id: p.id,
              jumlah: p.jumlah,
            })),
            sumber_dana: hitung.selisih < 0 ? sumberDana : null,
            catatan: catatan.trim() || null,
          }),
        { memuat: 'Memproses penukaran...', sukses: (d) => d.pesan }
      );
      ['transaksi', 'produk', 'menu', 'stok', 'dashboard', 'antrian-struk'].forEach((k) =>
        klien.invalidateQueries({ queryKey: [k] })
      );
      navigate(`/transaksi/${hasil.data.id}`);
    } catch {
      setSedangKirim(false);
    }
  }

  if (trx.isLoading) {
    return (
      <div className="space-y-4">
        <Rangka className="h-8 w-48" />
        <Rangka className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (trx.isError || !t) {
    return (
      <div className="mx-auto max-w-2xl">
        <Pemberitahuan warna="merah" ikon={LuTriangleAlert} judul="Transaksi tidak ditemukan" />
        <Button className="mt-4" asChild>
          <Link to="/transaksi">
            <LuArrowLeft /> Kembali
          </Link>
        </Button>
      </div>
    );
  }

  if (t.status !== 'selesai') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Pemberitahuan warna="kuning" ikon={LuTriangleAlert} judul="Transaksi ini tidak bisa ditukar">
          Hanya transaksi yang sudah selesai dibayar yang bisa ditukar barangnya. Transaksi{' '}
          {t.nomor} sekarang berstatus <strong>{t.status}</strong>.
        </Pemberitahuan>
        <Button asChild>
          <Link to={`/transaksi/${id}`}>
            <LuArrowLeft /> Kembali ke rincian
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="lg:flex lg:gap-5">
      <div className="min-w-0 flex-1">
        <Button variant="polos" className="mb-3 -ml-3" asChild>
          <Link to={`/transaksi/${id}`}>
            <LuArrowLeft /> Kembali ke rincian
          </Link>
        </Button>

        <KepalaHalaman
          judul="Tukar Barang"
          keterangan={`${t.nomor} · dibayar ${tanggalJam(t.dikonfirmasi_pada)} · ${rupiah(t.total)}`}
        />

        <Pemberitahuan warna="netral" className="mb-4" ikon={LuRepeat}>
          Barang yang <strong>tetap</strong> dihitung memakai harga lama yang sudah dibayar pembeli.
          Barang <strong>pengganti</strong> memakai harga yang berlaku hari ini. Transaksi lama akan
          ditandai <em>ditukar</em> dan transaksi baru dibuat dengan nomor sendiri.
        </Pemberitahuan>

        {/* Langkah 1 */}
        <div className="mb-4 rounded-2xl border-2 border-netral-200 bg-white p-4">
          <p className="font-bold text-coklat-900">1. Barang yang dikembalikan pembeli</p>
          <p className="mb-3 mt-0.5 text-sm text-coklat-400">
            Atur berapa banyak yang dikembalikan. Stoknya otomatis bertambah lagi.
          </p>

          <div className="divide-y-2 divide-netral-100">
            {t.item.map((i) => {
              const jumlahKembali = kembali[i.id] || 0;
              return (
                <div key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-coklat-900">{i.nama_barang}</p>
                    <p className="angka mt-0.5 text-xs text-coklat-400">
                      Dibeli {i.jumlah} x {rupiah(i.harga_dipakai)}
                      {i.harga_diskon != null && (
                        <span className="ml-1.5 rounded bg-daun-50 px-1.5 py-0.5 font-semibold text-daun-700">
                          {i.nama_diskon}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Kurangi"
                      onClick={() => ubahKembali(i.id, i.jumlah, -1)}
                      className="grid size-9 place-items-center rounded-lg border-2 border-netral-200 text-coklat-600 hover:border-boom-500"
                    >
                      <LuMinus className="size-3.5" />
                    </button>
                    <span
                      className={cn(
                        'angka w-10 text-center text-sm font-bold',
                        jumlahKembali > 0 ? 'text-boom-600' : 'text-coklat-400'
                      )}
                    >
                      {jumlahKembali}
                    </span>
                    <button
                      type="button"
                      aria-label="Tambah"
                      onClick={() => ubahKembali(i.id, i.jumlah, 1)}
                      className="grid size-9 place-items-center rounded-lg border-2 border-netral-200 text-coklat-600 hover:border-boom-500"
                    >
                      <LuPlus className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Langkah 2 */}
        <div className="rounded-2xl border-2 border-netral-200 bg-white p-4">
          <p className="font-bold text-coklat-900">2. Barang pengganti</p>
          <p className="mb-3 mt-0.5 text-sm text-coklat-400">
            Boleh dikosongkan kalau pembeli hanya mengembalikan tanpa menukar.
          </p>

          <div className="relative mb-3">
            <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
            <Input
              placeholder="Cari barang pengganti..."
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="pl-10 pr-10"
            />
            {cari && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setCari('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-coklat-400 hover:bg-coklat-50"
              >
                <LuX className="size-4" />
              </button>
            )}
          </div>

          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {katalog.map((b) => {
              const batas = b._jenis === 'produk' ? b.stok : b.sisa_porsi;
              const habis = batas != null && batas <= 0;
              return (
                <button
                  key={`${b._jenis}:${b.id}`}
                  type="button"
                  disabled={habis}
                  onClick={() => tambahPengganti(b, b._jenis)}
                  className={cn(
                    'rounded-xl border-2 p-2.5 text-left transition-colors',
                    habis
                      ? 'cursor-not-allowed border-netral-200 opacity-50'
                      : 'border-netral-200 hover:border-boom-500'
                  )}
                >
                  <p className="line-clamp-2 text-xs font-bold text-coklat-900">{b.nama}</p>
                  <p className="angka mt-1 text-xs font-extrabold text-boom-600">
                    {rupiah(b.harga_diskon ?? b.harga)}
                  </p>
                  <p className="angka text-xs text-coklat-400">
                    {habis ? 'habis' : batas != null ? `sisa ${batas}` : 'tak terbatas'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ringkasan uang */}
      <aside className="mt-5 w-full shrink-0 lg:mt-0 lg:w-[22rem] xl:w-96">
        <div className="space-y-4 lg:sticky lg:top-6">
          {pengganti.length > 0 && (
            <div className="rounded-2xl border-2 border-netral-200 bg-white p-4">
              <p className="mb-2 font-bold text-coklat-900">Barang pengganti dipilih</p>
              <div className="divide-y-2 divide-netral-100">
                {pengganti.map((p, idx) => (
                  <div key={`${p.jenis}:${p.id}`} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-coklat-900">{p.nama}</p>
                      <p className="angka text-xs text-coklat-400">
                        {p.jumlah} x {rupiah(p.harga)}
                      </p>
                    </div>
                    <span className="angka text-sm font-extrabold text-coklat-900">
                      {rupiah(p.harga * p.jumlah)}
                    </span>
                    <button
                      type="button"
                      aria-label="Lepaskan"
                      onClick={() => setPengganti(pengganti.filter((_, i) => i !== idx))}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-coklat-400 hover:bg-boom-50 hover:text-boom-600"
                    >
                      <LuTrash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border-2 border-netral-200 bg-white p-4">
            <p className="mb-3 font-bold text-coklat-900">Perhitungan</p>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-coklat-600">
                <span>Sudah dibayar</span>
                <span className="angka font-semibold">{rupiah(t.total)}</span>
              </div>
              <div className="flex justify-between text-coklat-600">
                <span>Barang tetap</span>
                <span className="angka font-semibold">{rupiah(hitung.tetap)}</span>
              </div>
              <div className="flex justify-between text-coklat-600">
                <span>Barang pengganti</span>
                <span className="angka font-semibold">{rupiah(hitung.baru)}</span>
              </div>
              {hitung.potongan > 0 && (
                <div className="flex justify-between text-daun-700">
                  <span>Diskon lama ikut dibawa</span>
                  <span className="angka font-semibold">- {rupiah(hitung.potongan)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-netral-200 pt-2">
                <span className="font-bold text-coklat-900">Total baru</span>
                <span className="angka font-extrabold text-coklat-900">
                  {rupiah(hitung.totalBaru)}
                </span>
              </div>
            </div>

            <div
              className={cn(
                'mt-3 rounded-xl border-2 p-3.5 text-center',
                hitung.selisih > 0
                  ? 'border-boom-200 bg-boom-50'
                  : hitung.selisih < 0
                    ? 'border-terakota-500 bg-biji-50'
                    : 'border-daun-300 bg-daun-50'
              )}
            >
              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-coklat-600">
                {hitung.selisih > 0 ? (
                  <>
                    <LuArrowUp className="size-4" /> Pembeli menambah bayar
                  </>
                ) : hitung.selisih < 0 ? (
                  <>
                    <LuArrowDown className="size-4" /> Kembalikan ke pembeli
                  </>
                ) : (
                  'Harganya pas'
                )}
              </p>
              <p
                className={cn(
                  'angka mt-0.5 text-2xl font-extrabold',
                  hitung.selisih > 0
                    ? 'text-boom-600'
                    : hitung.selisih < 0
                      ? 'text-terakota-500'
                      : 'text-daun-700'
                )}
              >
                {hitung.selisih === 0 ? 'Rp 0' : rupiah(Math.abs(hitung.selisih))}
              </p>
              {hitung.selisih > 0 && (
                <p className="mt-1 text-xs text-coklat-600">Bayar lewat QRIS seperti biasa.</p>
              )}
            </div>

            {hitung.selisih < 0 && (
              <div className="mt-3 space-y-3">
                <Pemberitahuan warna="kuning" ikon={LuTriangleAlert}>
                  Semua pembayaran lewat QRIS, jadi uangnya dikembalikan <strong>tunai</strong>.
                  Pilih sumber dananya supaya bisa dicocokkan nanti.
                </Pemberitahuan>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { nilai: 'kantor', label: 'Uang kantor', ikon: LuWallet, ket: 'Dari kas toko' },
                    { nilai: 'kasir', label: 'Ditalangi kasir', ikon: LuUser, ket: 'Nanti diganti' },
                  ].map((s) => (
                    <button
                      key={s.nilai}
                      type="button"
                      onClick={() => setSumberDana(s.nilai)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-colors',
                        sumberDana === s.nilai
                          ? 'border-boom-500 bg-boom-50'
                          : 'border-netral-200 hover:border-coklat-200'
                      )}
                    >
                      <s.ikon
                        className={cn(
                          'size-5',
                          sumberDana === s.nilai ? 'text-boom-600' : 'text-coklat-400'
                        )}
                      />
                      <span className="text-xs font-bold text-coklat-900">{s.label}</span>
                      <span className="text-center text-xs text-coklat-400">{s.ket}</span>
                    </button>
                  ))}
                </div>

                <Kolom label="Catatan" bantuan="Boleh dikosongkan.">
                  <Textarea
                    rows={2}
                    placeholder="Contoh: ditalangi Bagus, minta ganti ke kasir besar"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                  />
                </Kolom>
              </div>
            )}

            <Button
              ukuran="besar"
              className="mt-4 w-full"
              onClick={kirim}
              disabled={sedangKirim || !adaYangDikembalikan}
            >
              <LuRepeat />
              {sedangKirim ? 'Memproses...' : 'Proses penukaran'}
            </Button>

            {!adaYangDikembalikan && (
              <p className="mt-2 text-center text-xs text-coklat-400">
                Pilih dulu barang yang dikembalikan pembeli.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
