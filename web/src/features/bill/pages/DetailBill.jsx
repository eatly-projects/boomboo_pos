import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  LuArrowLeft, LuPlus, LuTrash2, LuSearch, LuX, LuNotebookPen, LuClock,
  LuTriangleAlert, LuCircleCheck, LuBan, LuTicketPercent,
} from 'react-icons/lu';
import { ambil, api, denganToast } from '@/shared/lib/api';
import { rupiah, tanggalJam, lamanya, nomorWaTampil } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, InputRupiah, Kolom, Textarea } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { Rangka, Label, Pemberitahuan, Kosong } from '@/shared/components/ui/tampilan';
import KartuBarang from '@/features/kasir/components/KartuBarang.jsx';
import { cn } from '@/shared/lib/utils';

const SARINGAN = [
  { nilai: 'semua', label: 'Semua' },
  { nilai: 'produk', label: 'Produk' },
  { nilai: 'menu', label: 'Menu Makan' },
];

export default function DetailBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const klien = useQueryClient();

  const [cari, setCari] = useState('');
  const [saringan, setSaringan] = useState('semua');
  const [sedangKirim, setSedangKirim] = useState(false);
  const [dialogTutup, setDialogTutup] = useState(false);
  const [dialogBatal, setDialogBatal] = useState(false);

  const bill = useQuery({ queryKey: ['bill', id], queryFn: () => ambil(`/bill/${id}`) });
  const produk = useQuery({
    queryKey: ['produk', 'kasir'],
    queryFn: () => ambil('/produk', { params: { hanya_dijual_satuan: true } }),
  });
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => ambil('/menu') });

  const barang = useMemo(() => {
    const semua = [
      ...(saringan !== 'menu' ? (produk.data || []).map((p) => ({ ...p, _jenis: 'produk' })) : []),
      ...(saringan !== 'produk' ? (menu.data || []).map((m) => ({ ...m, _jenis: 'menu' })) : []),
    ];
    const kata = cari.trim().toLowerCase();
    return kata ? semua.filter((b) => b.nama.toLowerCase().includes(kata)) : semua;
  }, [produk.data, menu.data, saringan, cari]);

  const b = bill.data;

  const segarkan = () =>
    ['bill', 'produk', 'menu', 'stok', 'dashboard'].forEach((k) =>
      klien.invalidateQueries({ queryKey: [k] })
    );

  async function tambahBarang(brg, jenis) {
    setSedangKirim(true);
    try {
      await denganToast(
        () =>
          api.post(`/bill/${id}/item`, {
            jenis_barang: jenis,
            barang_id: brg.id,
            jumlah: 1,
          }),
        { memuat: 'Menambahkan...', sukses: (d) => d.pesan }
      );
      segarkan();
    } catch {
      /* pesannya sudah muncul */
    } finally {
      setSedangKirim(false);
    }
  }

  async function hapusBarang(itemId) {
    setSedangKirim(true);
    try {
      await denganToast(() => api.delete(`/bill/${id}/item/${itemId}`), {
        memuat: 'Mencabut...',
        sukses: (d) => d.pesan,
      });
      segarkan();
    } catch {
      /* pesannya sudah muncul */
    } finally {
      setSedangKirim(false);
    }
  }

  if (bill.isLoading) {
    return (
      <div className="space-y-4">
        <Rangka className="h-8 w-48" />
        <Rangka className="h-32 w-full rounded-2xl" />
        <Rangka className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (bill.isError || !b) {
    return (
      <div className="mx-auto max-w-2xl">
        <Pemberitahuan warna="merah" ikon={LuTriangleAlert} judul="Bill tidak ditemukan" />
        <Button className="mt-4" asChild>
          <Link to="/bill">
            <LuArrowLeft /> Kembali
          </Link>
        </Button>
      </div>
    );
  }

  const terbuka = b.status === 'terbuka';
  const jumlahDiBill = (barangId, jenis) =>
    b.item
      .filter((i) => i.barang_id === barangId && i.jenis_barang === jenis)
      .reduce((t, i) => t + i.jumlah, 0);

  return (
    <div className="lg:flex lg:gap-5">
      {/* Kiri: pilih barang */}
      <div className="min-w-0 flex-1">
        <Button variant="polos" className="mb-3 -ml-3" asChild>
          <Link to="/bill">
            <LuArrowLeft /> Kembali ke Open Bill
          </Link>
        </Button>

        {/* Kepala bill */}
        <div
          className={cn(
            'mb-4 rounded-2xl border-2 bg-white p-4',
            terbuka ? 'border-boom-500' : 'border-netral-200'
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold text-coklat-900">{b.nama_pembeli}</h1>
                {b.penanda && <Label warna="netral">{b.penanda}</Label>}
                {terbuka && <Label warna="kuning">Masih terbuka</Label>}
                {b.status === 'selesai' && <Label warna="hijau">Sudah dibayar</Label>}
                {b.status === 'batal' && <Label warna="merah">Dibatalkan</Label>}
              </div>
              <p className="angka mt-0.5 text-sm text-coklat-600">
                {b.nomor}
                {b.nomor_wa && ` · ${nomorWaTampil(b.nomor_wa)}`}
              </p>
              <p className="mt-0.5 text-xs text-coklat-400">
                Dibuka {tanggalJam(b.dibuka_pada)} oleh {b.nama_pembuka}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-coklat-400">Tagihan berjalan</p>
              <p className="angka text-2xl font-extrabold text-boom-600">{rupiah(b.subtotal)}</p>
            </div>
          </div>

          {b.status === 'batal' && b.alasan_batal && (
            <p className="mt-3 rounded-lg bg-boom-50 px-3 py-2 text-sm text-coklat-900">
              Dibatalkan oleh {b.nama_pembatal}: {b.alasan_batal}
            </p>
          )}

          {b.status === 'selesai' && b.nomor_transaksi && (
            <Button variant="garis" ukuran="kecil" className="mt-3" asChild>
              <Link to={`/transaksi/${b.transaksi_id}`}>
                Lihat transaksi {b.nomor_transaksi}
              </Link>
            </Button>
          )}
        </div>

        {terbuka && (
          <>
            <Pemberitahuan warna="netral" className="mb-4" ikon={LuClock}>
              Setiap barang yang ditambahkan di sini <strong>langsung mengurangi stok</strong>,
              karena barangnya memang sudah diserahkan ke pembeli. Kalau pembeli batal, cabut
              barangnya atau batalkan billnya supaya stoknya kembali.
            </Pemberitahuan>

            <div className="mb-4 space-y-3">
              <div className="relative">
                <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
                <Input
                  placeholder="Cari nama produk atau menu..."
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  className="h-12 pl-10 pr-10"
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

              <div className="flex gap-1.5 rounded-xl bg-white p-1">
                {SARINGAN.map((s) => (
                  <button
                    key={s.nilai}
                    type="button"
                    onClick={() => setSaringan(s.nilai)}
                    className={cn(
                      'flex-1 rounded-lg py-2 text-sm font-bold transition-colors',
                      saringan === s.nilai
                        ? 'bg-boom-500 text-white'
                        : 'text-coklat-600 hover:bg-coklat-50'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pb-aman-28 sm:grid-cols-3 lg:pb-2 xl:grid-cols-4">
              {barang.map((brg) => (
                <KartuBarang
                  key={`${brg._jenis}:${brg.id}`}
                  barang={brg}
                  jenis={brg._jenis}
                  jumlahDiKeranjang={jumlahDiBill(brg.id, brg._jenis)}
                  onPilih={sedangKirim ? () => {} : tambahBarang}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Kanan: isi bill */}
      <aside className="mt-5 w-full shrink-0 lg:mt-0 lg:w-[22rem] xl:w-96">
        <div className="lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-2xl border-2 border-netral-200 bg-white">
            <div className="flex items-center gap-2 border-b-2 border-netral-200 px-4 py-3">
              <LuNotebookPen className="size-4.5 text-coklat-600" />
              <p className="font-bold text-coklat-900">Isi bill</p>
              {b.jumlah_barang > 0 && (
                <span className="angka rounded-lg bg-boom-500 px-2 py-0.5 text-xs font-bold text-white">
                  {b.jumlah_barang}
                </span>
              )}
            </div>

            <div className="max-h-[50dvh] overflow-y-auto px-4">
              {b.item.length === 0 ? (
                <Kosong
                  ikon={LuNotebookPen}
                  judul="Bill masih kosong"
                  keterangan={
                    terbuka
                      ? 'Pilih barang di sebelah kiri untuk mulai mencatat pesanan.'
                      : 'Tidak ada barang yang tercatat di bill ini.'
                  }
                />
              ) : (
                <div className="divide-y-2 divide-netral-100">
                  {b.item.map((i) => (
                    <div key={i.id} className="flex gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-snug text-coklat-900">
                          {i.nama_barang}
                        </p>
                        <p className="angka mt-0.5 text-xs text-coklat-400">
                          {i.jumlah} x {rupiah(i.harga_dipakai)}
                          {i.harga_diskon != null && (
                            <span className="ml-1.5 rounded bg-daun-50 px-1.5 py-0.5 font-semibold text-daun-700">
                              {i.nama_diskon}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-coklat-400">
                          dicatat {i.nama_penambah} &middot; {tanggalJam(i.dibuat_pada)}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="angka text-sm font-extrabold text-coklat-900">
                          {rupiah(i.subtotal)}
                        </p>
                        {terbuka && (
                          <button
                            type="button"
                            aria-label="Cabut dari bill"
                            onClick={() => hapusBarang(i.id)}
                            disabled={sedangKirim}
                            className="mt-1 grid size-8 place-items-center rounded-lg text-coklat-400 transition-colors hover:bg-boom-50 hover:text-boom-600"
                          >
                            <LuTrash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {b.item.length > 0 && (
              <div className="space-y-3 border-t-2 border-netral-200 p-4">
                <div className="flex items-end justify-between">
                  <span className="font-bold text-coklat-900">Tagihan berjalan</span>
                  <span className="angka text-xl font-extrabold text-boom-600">
                    {rupiah(b.subtotal)}
                  </span>
                </div>

                {terbuka && (
                  <div className="flex flex-col gap-2">
                    <Button
                      ukuran="besar"
                      variant="hijau"
                      onClick={() => setDialogTutup(true)}
                      disabled={sedangKirim}
                    >
                      <LuCircleCheck /> Tutup &amp; bayar
                    </Button>
                    <Button
                      variant="bahaya"
                      onClick={() => setDialogBatal(true)}
                      disabled={sedangKirim}
                    >
                      <LuBan /> Batalkan bill
                    </Button>
                  </div>
                )}
              </div>
            )}

            {terbuka && b.item.length === 0 && (
              <div className="border-t-2 border-netral-200 p-4">
                <Button variant="bahaya" className="w-full" onClick={() => setDialogBatal(true)}>
                  <LuBan /> Batalkan bill kosong ini
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {dialogTutup && (
        <DialogTutupBill
          bill={b}
          onTutup={() => setDialogTutup(false)}
          onSelesai={(trx) => {
            segarkan();
            navigate(`/kasir/bayar/${trx.id}`);
          }}
        />
      )}

      {dialogBatal && (
        <DialogBatalBill
          bill={b}
          onTutup={() => setDialogBatal(false)}
          onSelesai={() => {
            segarkan();
            navigate('/bill');
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function DialogTutupBill({ bill, onTutup, onSelesai }) {
  const [pakaiDiskon, setPakaiDiskon] = useState(false);
  const [jenis, setJenis] = useState('persen');
  const [nilai, setNilai] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);

  const potongan = !pakaiDiskon || !nilai
    ? 0
    : jenis === 'persen'
      ? Math.min(Math.round((bill.subtotal * Number(nilai)) / 100), bill.subtotal)
      : Math.min(Number(nilai), bill.subtotal);
  const total = bill.subtotal - potongan;

  async function kirim() {
    setSedangKirim(true);
    try {
      const hasil = await denganToast(
        () =>
          api.post(`/bill/${bill.id}/tutup`, {
            diskon_jenis: pakaiDiskon && nilai ? jenis : null,
            diskon_nilai: pakaiDiskon && nilai ? Number(nilai) : null,
          }),
        { memuat: 'Menutup bill...', sukses: (d) => d.pesan }
      );
      onSelesai(hasil.data);
    } catch {
      setSedangKirim(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onTutup()}>
      <DialogContent
        judul="Tutup bill dan bayar"
        keterangan={`${bill.nama_pembeli} · ${bill.jumlah_barang} barang. Setelah ditutup, isinya tidak bisa diubah lagi.`}
      >
        <div className="space-y-4">
          {!pakaiDiskon ? (
            <button
              type="button"
              onClick={() => setPakaiDiskon(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-netral-300 py-2.5 text-sm font-semibold text-coklat-600 transition-colors hover:border-boom-500 hover:text-boom-600"
            >
              <LuTicketPercent className="size-4" />
              Beri diskon
            </button>
          ) : (
            <div className="rounded-xl border-2 border-netral-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-coklat-900">Diskon</p>
                <button
                  type="button"
                  onClick={() => {
                    setPakaiDiskon(false);
                    setNilai('');
                  }}
                  className="text-xs font-semibold text-coklat-400 hover:text-boom-600"
                >
                  Hapus diskon
                </button>
              </div>

              <div className="mb-2 grid grid-cols-2 gap-1.5 rounded-lg bg-netral-100 p-1">
                {[
                  { nilai: 'persen', label: 'Persen (%)' },
                  { nilai: 'nominal', label: 'Potongan (Rp)' },
                ].map((p) => (
                  <button
                    key={p.nilai}
                    type="button"
                    onClick={() => setJenis(p.nilai)}
                    className={cn(
                      'rounded-md py-1.5 text-xs font-bold transition-colors',
                      jenis === p.nilai
                        ? 'bg-white text-coklat-900 shadow-sm'
                        : 'text-coklat-400 hover:text-coklat-900'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {jenis === 'persen' ? (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  placeholder="Contoh: 10"
                  value={nilai}
                  onChange={(e) => setNilai(e.target.value)}
                  className="angka h-10"
                />
              ) : (
                <InputRupiah
                  placeholder="Contoh: 15000"
                  value={nilai === '' ? '' : Number(nilai)}
                  onChange={(n) => setNilai(n === '' ? '' : String(n))}
                  className="h-10"
                />
              )}
            </div>
          )}

          <div className="space-y-1.5 rounded-xl bg-coklat-50 p-3 text-sm">
            <div className="flex justify-between text-coklat-600">
              <span>Subtotal</span>
              <span className="angka font-semibold">{rupiah(bill.subtotal)}</span>
            </div>
            {potongan > 0 && (
              <div className="flex justify-between text-daun-700">
                <span>Diskon</span>
                <span className="angka font-semibold">- {rupiah(potongan)}</span>
              </div>
            )}
            <div className="flex items-end justify-between border-t-2 border-netral-200 pt-2">
              <span className="font-bold text-coklat-900">Total bayar</span>
              <span className="angka text-xl font-extrabold text-boom-600">{rupiah(total)}</span>
            </div>
          </div>

          <p className="text-xs text-coklat-400">
            Setelah ditutup Anda langsung diarahkan ke layar QRIS. Stok tidak dipotong lagi, karena
            sudah berkurang sejak barangnya dimasukkan ke bill.
          </p>

          <DialogFooter>
            <Button variant="garis" onClick={onTutup} disabled={sedangKirim}>
              Belum, masih mau pesan lagi
            </Button>
            <Button variant="hijau" onClick={kirim} disabled={sedangKirim}>
              {sedangKirim ? 'Memproses...' : 'Tutup & lanjut bayar'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogBatalBill({ bill, onTutup, onSelesai }) {
  const [alasan, setAlasan] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);

  async function kirim() {
    setSedangKirim(true);
    try {
      await denganToast(
        () => api.post(`/bill/${bill.id}/batal`, { alasan: alasan.trim() || undefined }),
        { memuat: 'Membatalkan...', sukses: (d) => d.pesan }
      );
      onSelesai();
    } catch {
      setSedangKirim(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onTutup()}>
      <DialogContent
        judul="Batalkan bill ini?"
        keterangan={`Seluruh ${bill.jumlah_barang} barang di bill ${bill.nama_pembeli} akan dikembalikan ke stok lewat catatan pergerakan baru. Riwayatnya tetap utuh.`}
      >
        <Kolom label="Alasan pembatalan" bantuan="Boleh dikosongkan, tapi sebaiknya diisi.">
          <Textarea
            rows={3}
            autoFocus
            placeholder="Contoh: Pembeli pergi tanpa membayar"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
          />
        </Kolom>

        <DialogFooter>
          <Button variant="garis" onClick={onTutup} disabled={sedangKirim}>
            Tidak jadi
          </Button>
          <Button variant="bahaya" onClick={kirim} disabled={sedangKirim}>
            {sedangKirim ? 'Membatalkan...' : 'Ya, batalkan bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
