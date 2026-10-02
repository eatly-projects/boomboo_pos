import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LuArrowLeft, LuTriangleAlert, LuExternalLink, LuBan, LuCopy, LuCheck,
  LuRepeat, LuArrowRight, LuWallet, LuUser, LuNotebookPen,
} from 'react-icons/lu';
import toast from 'react-hot-toast';
import { ambil, api, denganToast } from '@/shared/lib/api';
import {
  rupiah, tanggalJam, labelMetode, labelStatus, labelStatusStruk, nomorWaTampil,
} from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Textarea, Kolom } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';
import { KepalaHalaman, Rangka, Label, Pemberitahuan } from '@/shared/components/ui/tampilan';

const warnaStatus = (s) =>
  ({ selesai: 'hijau', menunggu_pembayaran: 'kuning', batal: 'merah', ditukar: 'kuning' })[s] ||
  'netral';

function Baris({ label, nilai, tebal }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-sm text-coklat-400">{label}</span>
      <span
        className={
          tebal ? 'angka text-right font-extrabold text-coklat-900' : 'angka text-right text-sm font-semibold text-coklat-900'
        }
      >
        {nilai}
      </span>
    </div>
  );
}

export default function DetailTransaksi() {
  const { id } = useParams();
  const klien = useQueryClient();
  const [dialogBatal, setDialogBatal] = useState(false);
  const [alasan, setAlasan] = useState('');
  const [sedangKirim, setSedangKirim] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  const data = useQuery({ queryKey: ['transaksi', id], queryFn: () => ambil(`/transaksi/${id}`) });
  const t = data.data;

  async function batalkan() {
    setSedangKirim(true);
    try {
      await denganToast(
        () => api.post(`/transaksi/${id}/batal`, { alasan: alasan.trim() || undefined }),
        { memuat: 'Membatalkan transaksi...', sukses: (d) => d.pesan }
      );
      klien.invalidateQueries({ queryKey: ['transaksi'] });
      klien.invalidateQueries({ queryKey: ['stok'] });
      klien.invalidateQueries({ queryKey: ['produk'] });
      setDialogBatal(false);
    } catch {
      // toast sudah muncul
    } finally {
      setSedangKirim(false);
    }
  }

  function salinLink() {
    const link = `${location.origin}/struk/${t.kode_struk}`;
    navigator.clipboard?.writeText(link).then(
      () => {
        setTersalin(true);
        toast.success('Link struk disalin.');
        setTimeout(() => setTersalin(false), 2000);
      },
      () => toast.error('Tidak bisa menyalin link.')
    );
  }

  if (data.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Rangka className="h-8 w-48" />
        <Rangka className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (data.isError || !t) {
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

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="polos" className="mb-3 -ml-3" asChild>
        <Link to="/transaksi">
          <LuArrowLeft /> Kembali ke Transaksi
        </Link>
      </Button>

      <KepalaHalaman judul={t.nomor} keterangan={tanggalJam(t.dibuat_pada)} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Label warna={warnaStatus(t.status)}>{labelStatus(t.status)}</Label>
        {t.metode_bayar && <Label warna="netral">{labelMetode(t.metode_bayar)}</Label>}
        <Label warna="netral">Struk: {labelStatusStruk(t.status_struk)}</Label>
      </div>

      {t.ditandai_stok_kurang && (
        <Pemberitahuan
          warna="merah"
          className="mb-4"
          ikon={LuTriangleAlert}
          judul="Transaksi ini diloloskan walau stok kurang"
        >
          Saat pembayaran dikonfirmasi, ada produk yang stoknya keburu diambil kasir lain.
          Transaksinya tetap diteruskan karena uang pembeli sudah masuk. Periksa stok fisiknya.
        </Pemberitahuan>
      )}

      {/* Rincian barang */}
      <div className="mb-3 rounded-2xl border-2 border-netral-200 bg-white p-4">
        <p className="mb-3 font-bold text-coklat-900">Rincian belanja</p>

        <div className="divide-y-2 divide-netral-100">
          {t.item.map((i) => (
            <div key={i.id} className="flex justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-coklat-900">{i.nama_barang}</p>
                <p className="angka mt-0.5 text-xs text-coklat-400">
                  {i.jumlah} x {rupiah(i.harga_dipakai)}
                  {i.harga_diskon != null && (
                    <span className="ml-1.5 rounded bg-daun-50 px-1.5 py-0.5 font-semibold text-daun-700">
                      {i.nama_diskon}
                    </span>
                  )}
                </p>
                {i.harga_diskon != null && (
                  <p className="angka text-xs text-coklat-400 line-through">
                    Harga normal {rupiah(i.harga_normal)}
                  </p>
                )}
              </div>
              <p className="angka shrink-0 text-sm font-extrabold text-coklat-900">
                {rupiah(i.subtotal)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t-2 border-netral-200 pt-3">
          <Baris label="Subtotal" nilai={rupiah(t.subtotal)} />
          {t.diskon_rupiah > 0 && (
            <Baris
              label={`Diskon kasir ${t.diskon_jenis === 'persen' ? `(${t.diskon_nilai}%)` : ''}`}
              nilai={`- ${rupiah(t.diskon_rupiah)}`}
            />
          )}
          <div className="mt-1 border-t-2 border-netral-200 pt-2">
            <Baris label="Total" nilai={rupiah(t.total)} tebal />
          </div>

        </div>
      </div>

      {/* Keterangan lain */}
      <div className="mb-3 rounded-2xl border-2 border-netral-200 bg-white p-4">
        <p className="mb-2 font-bold text-coklat-900">Keterangan</p>
        <Baris label="Kasir" nilai={t.nama_kasir} />
        {t.nama_pengonfirmasi && (
          <Baris label="Dikonfirmasi oleh" nilai={t.nama_pengonfirmasi} />
        )}
        {t.dikonfirmasi_pada && (
          <Baris label="Waktu pembayaran" nilai={tanggalJam(t.dikonfirmasi_pada)} />
        )}
        <Baris label="Nama pembeli" nilai={t.nama_pembeli || 'Tidak diisi'} />
        <Baris
          label="Nomor WhatsApp"
          nilai={t.nomor_wa ? nomorWaTampil(t.nomor_wa) : 'Tidak diisi'}
        />
        {t.status === 'batal' && (
          <>
            <Baris label="Dibatalkan oleh" nilai={t.nama_pembatal || '-'} />
            <Baris label="Waktu pembatalan" nilai={tanggalJam(t.dibatalkan_pada)} />
            <Baris label="Alasan" nilai={t.alasan_batal || 'Tidak diisi'} />
          </>
        )}
      </div>

      {/* Jejak penukaran */}
      {(t.ditukar_dari_id || t.ditukar_ke_id || t.penukaran?.length > 0) && (
        <div className="mb-3 rounded-2xl border-2 border-terakota-500 bg-biji-50 p-4">
          <p className="mb-2 flex items-center gap-2 font-bold text-coklat-900">
            <LuRepeat className="size-4.5 text-terakota-500" /> Riwayat penukaran
          </p>

          {t.ditukar_ke_id && (
            <p className="text-sm text-coklat-600">
              Transaksi ini sudah ditukar. Penggantinya{' '}
              <Link
                to={`/transaksi/${t.ditukar_ke_id}`}
                className="angka font-bold text-biru-500 hover:underline"
              >
                {t.nomor_transaksi_baru}
              </Link>
              .
            </p>
          )}

          {t.ditukar_dari_id && (
            <p className="text-sm text-coklat-600">
              Transaksi ini hasil penukaran dari{' '}
              <Link
                to={`/transaksi/${t.ditukar_dari_id}`}
                className="angka font-bold text-biru-500 hover:underline"
              >
                {t.nomor_transaksi_lama}
              </Link>
              .
            </p>
          )}

          {t.penukaran?.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-coklat-400">
                  Dikembalikan pembeli
                </p>
                {t.penukaran
                  .filter((p) => p.arah === 'dikembalikan')
                  .map((p) => (
                    <p key={p.id} className="angka text-sm text-coklat-900">
                      {p.jumlah}x {p.nama_barang}{' '}
                      <span className="text-coklat-400">({rupiah(p.subtotal)})</span>
                    </p>
                  ))}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-coklat-400">
                  Diganti dengan
                </p>
                {t.penukaran.filter((p) => p.arah === 'pengganti').length === 0 ? (
                  <p className="text-sm text-coklat-400">Tidak ada pengganti</p>
                ) : (
                  t.penukaran
                    .filter((p) => p.arah === 'pengganti')
                    .map((p) => (
                      <p key={p.id} className="angka text-sm text-coklat-900">
                        {p.jumlah}x {p.nama_barang}{' '}
                        <span className="text-coklat-400">({rupiah(p.subtotal)})</span>
                      </p>
                    ))
                )}
              </div>
            </div>
          )}

          {t.uang_masuk != null && t.ditukar_dari_id && (
            <p className="angka mt-3 border-t-2 border-biji-500 pt-2 text-sm font-bold text-coklat-900">
              Uang yang bergerak saat penukaran:{' '}
              <span className={t.uang_masuk < 0 ? 'text-terakota-500' : 'text-boom-600'}>
                {t.uang_masuk < 0 ? '- ' : '+ '}
                {rupiah(Math.abs(t.uang_masuk))}
              </span>
            </p>
          )}

          {t.pengembalian_uang && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-coklat-600">
              {t.pengembalian_uang.sumber_dana === 'kasir' ? (
                <LuUser className="size-4" />
              ) : (
                <LuWallet className="size-4" />
              )}
              Uang dikembalikan dari{' '}
              <strong>
                {t.pengembalian_uang.sumber_dana === 'kasir'
                  ? `kantong ${t.pengembalian_uang.nama_user}`
                  : 'uang kantor'}
              </strong>
              {t.pengembalian_uang.sumber_dana === 'kasir' &&
                !t.pengembalian_uang.sudah_diganti &&
                ' — belum diganti'}
            </p>
          )}
        </div>
      )}

      {t.bill_id && (
        <Pemberitahuan warna="netral" className="mb-3" ikon={LuNotebookPen}>
          Transaksi ini berasal dari Open Bill. Stok barangnya sudah berkurang sejak dipesan.
        </Pemberitahuan>
      )}

      {/* Tindakan */}
      <div className="flex flex-wrap gap-2">
        {t.status === 'selesai' && (
          <Button variant="garis" asChild>
            <Link to={`/transaksi/${t.id}/tukar`}>
              <LuRepeat /> Tukar barang
            </Link>
          </Button>
        )}
        {t.status === 'selesai' && (
          <>
            <Button variant="garis" asChild>
              <a href={`/struk/${t.kode_struk}`} target="_blank" rel="noreferrer">
                <LuExternalLink /> Buka struk
              </a>
            </Button>
            <Button variant="garis" onClick={salinLink}>
              {tersalin ? <LuCheck /> : <LuCopy />} Salin link struk
            </Button>
          </>
        )}
        {t.status !== 'batal' && t.status !== 'ditukar' && (
          <Button variant="bahaya" onClick={() => setDialogBatal(true)}>
            <LuBan /> Batalkan transaksi
          </Button>
        )}
      </div>

      <Dialog open={dialogBatal} onOpenChange={setDialogBatal}>
        <DialogContent
          judul="Batalkan transaksi ini?"
          keterangan={
            t.status === 'selesai'
              ? 'Karena transaksi ini sudah selesai, stok produknya akan dikembalikan lewat catatan pergerakan baru. Riwayat lama tetap utuh.'
              : 'Transaksi akan ditandai batal. Stok tidak berubah karena belum pernah dikurangi.'
          }
        >
          <Kolom label="Alasan pembatalan" bantuan="Boleh dikosongkan, tapi sebaiknya diisi.">
            <Textarea
              rows={3}
              autoFocus
              placeholder="Contoh: Pembeli berubah pikiran"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </Kolom>

          <DialogFooter>
            <Button variant="garis" onClick={() => setDialogBatal(false)} disabled={sedangKirim}>
              Tidak jadi
            </Button>
            <Button variant="bahaya" onClick={batalkan} disabled={sedangKirim}>
              {sedangKirim ? 'Membatalkan...' : 'Ya, batalkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
