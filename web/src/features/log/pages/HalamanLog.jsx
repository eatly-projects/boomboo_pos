import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LuHistory, LuSearch, LuFilter } from 'react-icons/lu';
import { ambil } from '@/shared/lib/api';
import { tanggalJam, labelAksi, keIsoTanggal, rupiah } from '@/shared/lib/format';
import { Button } from '@/shared/components/ui/button';
import { Input, Kolom } from '@/shared/components/ui/input';
import { Pilihan } from '@/shared/components/ui/select';
import { KepalaHalaman, Kosong, Rangka, Label } from '@/shared/components/ui/tampilan';

const warnaEntitas = (e) =>
  ({
    produk: 'merah',
    menu: 'kuning',
    stok: 'biru',
    transaksi: 'hijau',
    user: 'netral',
    media: 'netral',
    pengaturan: 'netral',
  })[e] || 'netral';

/** Menerjemahkan isi detail log menjadi kalimat yang enak dibaca orang awam. */
function RincianLog({ log }) {
  const d = log.detail;
  if (!d || typeof d !== 'object') return null;

  const baris = [];

  // Bentuk { kolom: { sebelum, sesudah } }
  for (const [kunci, nilai] of Object.entries(d)) {
    if (nilai && typeof nilai === 'object' && 'sebelum' in nilai) {
      const uang = ['harga', 'harga_diskon'].includes(kunci);
      baris.push(
        `${kunci.replace(/_/g, ' ')}: ${
          nilai.sebelum == null ? 'kosong' : uang ? rupiah(nilai.sebelum) : nilai.sebelum
        } menjadi ${
          nilai.sesudah == null ? 'kosong' : uang ? rupiah(nilai.sesudah) : nilai.sesudah
        }`
      );
    }
  }

  if (baris.length === 0) {
    const ringkas = [];
    if (d.ditambah != null) ringkas.push(`ditambah ${d.ditambah}`);
    if (d.dikurangi != null) ringkas.push(`dikurangi ${d.dikurangi}`);
    if (d.alasan) ringkas.push(`alasan: ${d.alasan}`);
    if (d.stok_sebelum != null) ringkas.push(`stok ${d.stok_sebelum} menjadi ${d.stok_sesudah}`);
    if (d.metode_bayar) ringkas.push(`bayar ${d.metode_bayar.toUpperCase()}`);
    if (d.total != null) ringkas.push(`total ${rupiah(d.total)}`);
    if (d.potongan_rupiah != null) ringkas.push(`potongan ${rupiah(d.potongan_rupiah)}`);
    if (d.jenis && d.nilai_diketik != null)
      ringkas.push(`diskon ${d.nilai_diketik}${d.jenis === 'persen' ? '%' : ' rupiah'}`);
    if (d.yang_diubah)
      ringkas.push(
        `yang diubah: ${Array.isArray(d.yang_diubah) ? d.yang_diubah.join(', ') : d.yang_diubah}`
      );
    if (d.jumlah_produk_dihitung != null)
      ringkas.push(
        `${d.jumlah_produk_dihitung} produk dihitung, ${d.jumlah_produk_berubah} disesuaikan`
      );
    if (d.jumlah_berkas != null) ringkas.push(`${d.jumlah_berkas} berkas`);
    if (d.catatan) ringkas.push(d.catatan);
    if (d.cara) ringkas.push(d.cara);
    baris.push(...ringkas);
  }

  if (baris.length === 0) return null;

  return (
    <p className="mt-1 text-sm capitalize text-coklat-600">{baris.join(' · ')}</p>
  );
}

export default function HalamanLog() {
  const [saring, setSaring] = useState({
    cari: '',
    aksi: 'semua',
    entitas: 'semua',
    nama_user: 'semua',
    tanggal_dari: '',
    tanggal_sampai: '',
  });
  const [halaman, setHalaman] = useState(1);
  const [saringTerbuka, setSaringTerbuka] = useState(false);

  const pilihan = useQuery({ queryKey: ['log-pilihan'], queryFn: () => ambil('/log/pilihan') });

  const params = {
    halaman,
    per_halaman: 40,
    ...(saring.cari ? { cari: saring.cari } : {}),
    ...(saring.aksi !== 'semua' ? { aksi: saring.aksi } : {}),
    ...(saring.entitas !== 'semua' ? { entitas: saring.entitas } : {}),
    ...(saring.nama_user !== 'semua' ? { nama_user: saring.nama_user } : {}),
    ...(saring.tanggal_dari ? { tanggal_dari: saring.tanggal_dari } : {}),
    ...(saring.tanggal_sampai ? { tanggal_sampai: saring.tanggal_sampai } : {}),
  };

  const data = useQuery({ queryKey: ['log', params], queryFn: () => ambil('/log', { params }) });

  const daftar = data.data?.daftar || [];
  const info = data.data?.halaman;
  const totalHalaman = info ? Math.max(Math.ceil(info.total / info.per_halaman), 1) : 1;

  const ubah = (k) => (v) => {
    setSaring((s) => ({ ...s, [k]: v }));
    setHalaman(1);
  };

  const opsi = (daftarNilai, semuaLabel, pemberiLabel = (v) => v) => [
    { nilai: 'semua', label: semuaLabel },
    ...(daftarNilai || []).map((v) => ({ nilai: v, label: pemberiLabel(v) })),
  ];

  return (
    <div>
      <KepalaHalaman
        judul="Log Aktivitas"
        keterangan="Catatan semua yang dilakukan di aplikasi ini: apa, kapan, dan oleh siapa."
        aksi={
          <Button variant="garis" onClick={() => setSaringTerbuka((v) => !v)}>
            <LuFilter /> {saringTerbuka ? 'Tutup penyaring' : 'Penyaring'}
          </Button>
        }
      />

      <div className="relative mb-3">
        <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-coklat-400" />
        <Input
          placeholder="Cari nama produk, menu, atau nomor transaksi..."
          value={saring.cari}
          onChange={(e) => ubah('cari')(e.target.value)}
          className="pl-10"
        />
      </div>

      {saringTerbuka && (
        <div className="animasi-naik mb-4 grid gap-3 rounded-2xl border-2 border-netral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kolom label="Jenis aktivitas">
            <Pilihan
              nilai={saring.aksi}
              onUbah={ubah('aksi')}
              daftar={opsi(pilihan.data?.aksi, 'Semua aktivitas', labelAksi)}
            />
          </Kolom>
          <Kolom label="Bagian">
            <Pilihan
              nilai={saring.entitas}
              onUbah={ubah('entitas')}
              daftar={opsi(pilihan.data?.entitas, 'Semua bagian')}
            />
          </Kolom>
          <Kolom label="Dilakukan oleh">
            <Pilihan
              nilai={saring.nama_user}
              onUbah={ubah('nama_user')}
              daftar={opsi(pilihan.data?.user, 'Semua orang')}
            />
          </Kolom>
          <Kolom label="Tanggal mulai">
            <Input
              type="date"
              max={keIsoTanggal(new Date())}
              value={saring.tanggal_dari}
              onChange={(e) => ubah('tanggal_dari')(e.target.value)}
            />
          </Kolom>
          <Kolom label="Tanggal akhir">
            <Input
              type="date"
              max={keIsoTanggal(new Date())}
              value={saring.tanggal_sampai}
              onChange={(e) => ubah('tanggal_sampai')(e.target.value)}
            />
          </Kolom>
        </div>
      )}

      {data.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Rangka key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <Kosong
          ikon={LuHistory}
          judul="Belum ada catatan"
          keterangan="Tidak ada aktivitas yang cocok dengan penyaring yang dipakai."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-coklat-400">
            Menampilkan <span className="angka font-bold text-coklat-900">{daftar.length}</span>{' '}
            dari <span className="angka font-bold text-coklat-900">{info?.total}</span> catatan
          </p>

          <div className="space-y-2">
            {daftar.map((l) => (
              <div key={l.id} className="rounded-2xl border-2 border-netral-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-coklat-900">{labelAksi(l.aksi)}</span>
                  <Label warna={warnaEntitas(l.entitas)}>{l.entitas}</Label>
                </div>

                {l.nama_entitas && (
                  <p className="mt-0.5 text-sm font-semibold text-coklat-900">{l.nama_entitas}</p>
                )}

                <RincianLog log={l} />

                <p className="mt-1.5 text-xs text-coklat-400">
                  {l.nama_user} &middot; {tanggalJam(l.dibuat_pada)}
                </p>
              </div>
            ))}
          </div>

          {totalHalaman > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="garis"
                disabled={halaman <= 1}
                onClick={() => setHalaman((h) => h - 1)}
              >
                Sebelumnya
              </Button>
              <p className="angka text-sm text-coklat-400">
                Halaman {halaman} dari {totalHalaman}
              </p>
              <Button
                variant="garis"
                disabled={halaman >= totalHalaman}
                onClick={() => setHalaman((h) => h + 1)}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
