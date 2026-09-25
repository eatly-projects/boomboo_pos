import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { LuEye, LuEyeOff } from 'react-icons/lu';
import { cn } from '@/shared/lib/utils';

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-11 w-full rounded-xl border-2 border-netral-200 bg-white px-3 py-2 text-coklat-900 transition-colors',
      'placeholder:text-netral-500',
      'focus-visible:outline-none focus-visible:border-boom-500',
      'disabled:cursor-not-allowed disabled:bg-netral-100 disabled:opacity-70',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

/** Kolom kata sandi selalu punya tombol lihat/sembunyi. */
const InputPassword = React.forwardRef(({ className, ...props }, ref) => {
  const [terlihat, setTerlihat] = React.useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={terlihat ? 'text' : 'password'}
        className={cn('pr-12', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setTerlihat((v) => !v)}
        aria-label={terlihat ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-coklat-400 transition-colors hover:bg-coklat-50 hover:text-coklat-900"
      >
        {terlihat ? <LuEyeOff className="size-4" /> : <LuEye className="size-4" />}
      </button>
    </div>
  );
});
InputPassword.displayName = 'InputPassword';

/**
 * Kolom isian uang.
 *
 * Yang DILIHAT pengguna berbentuk rupiah lengkap dengan titik pemisah
 * ribuan, misalnya "Rp 35.000". Yang DISIMPAN dan dikirim ke server tetap
 * angka polos, yaitu 35000. Titik dan huruf "Rp" tidak pernah ikut terkirim.
 *
 *   <InputRupiah value={harga} onChange={setHarga} />
 *
 * `value`    : angka, atau string kosong kalau belum diisi
 * `onChange` : dipanggil dengan angka, atau string kosong kalau dikosongkan
 */
const InputRupiah = React.forwardRef(({ value, onChange, className, ...props }, ref) => {
  const kolomRef = React.useRef(null);
  const karetRef = React.useRef(null);

  const gabungRef = (el) => {
    kolomRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const kosong = value === '' || value === null || value === undefined;
  const tampilan = kosong ? '' : 'Rp ' + Number(value).toLocaleString('id-ID');

  // Setelah angkanya ditulis ulang dengan titik, posisi kursor dikembalikan
  // ke tempat yang sama menurut hitungan angka, bukan hitungan huruf.
  React.useLayoutEffect(() => {
    const el = kolomRef.current;
    const target = karetRef.current;
    if (!el || target === null) return;
    karetRef.current = null;

    let angkaTerlewat = 0;
    let posisi = el.value.length;
    for (let i = 0; i < el.value.length; i++) {
      if (/\d/.test(el.value[i])) angkaTerlewat++;
      if (angkaTerlewat >= target) {
        posisi = i + 1;
        break;
      }
    }
    if (target === 0) posisi = el.value.length ? 3 : 0; // tepat setelah "Rp "
    el.setSelectionRange(posisi, posisi);
  });

  function tangkapKetikan(e) {
    const el = e.target;
    const sebelumKaret = el.value.slice(0, el.selectionStart).replace(/\D/g, '').length;
    const angka = el.value.replace(/\D/g, '');

    karetRef.current = sebelumKaret;
    onChange?.(angka === '' ? '' : Number(angka));
  }

  // Menghapus mundur tepat di belakang titik pemisah terasa macet kalau
  // dibiarkan, karena yang terhapus cuma titiknya. Di sini titiknya dilompati
  // supaya yang terhapus benar-benar angkanya.
  function tanganiHapus(e) {
    if (e.key !== 'Backspace') return;
    const el = e.target;
    if (el.selectionStart !== el.selectionEnd) return;

    const posisi = el.selectionStart;
    if (posisi === 0 || /\d/.test(el.value[posisi - 1])) return;

    e.preventDefault();
    let i = posisi;
    while (i > 0 && !/\d/.test(el.value[i - 1])) i--;
    if (i === 0) return;

    const sisa = (el.value.slice(0, i - 1) + el.value.slice(posisi)).replace(/\D/g, '');
    karetRef.current = el.value.slice(0, i - 1).replace(/\D/g, '').length;
    onChange?.(sisa === '' ? '' : Number(sisa));
  }

  return (
    <input
      ref={gabungRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={tampilan}
      onChange={tangkapKetikan}
      onKeyDown={tanganiHapus}
      className={cn(
        'angka flex h-11 w-full rounded-xl border-2 border-netral-200 bg-white px-3 py-2 text-coklat-900 transition-colors',
        'placeholder:font-normal placeholder:text-netral-500',
        'focus-visible:outline-none focus-visible:border-boom-500',
        'disabled:cursor-not-allowed disabled:bg-netral-100 disabled:opacity-70',
        className
      )}
      {...props}
    />
  );
});
InputRupiah.displayName = 'InputRupiah';

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-semibold text-coklat-900', className)}
    {...props}
  />
));
Label.displayName = 'Label';

/** Satu kolom isian lengkap: label, isian, keterangan bantu, pesan kesalahan. */
function Kolom({ label, bantuan, galat, wajib, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label>
          {label}
          {wajib && <span className="ml-1 text-boom-500">*</span>}
        </Label>
      )}
      {children}
      {bantuan && !galat && <p className="text-xs text-coklat-400">{bantuan}</p>}
      {galat && <p className="text-xs font-medium text-boom-600">{galat}</p>}
    </div>
  );
}

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-20 w-full rounded-xl border-2 border-netral-200 bg-white px-3 py-2 text-coklat-900',
      'placeholder:text-netral-500 focus-visible:outline-none focus-visible:border-boom-500',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Input, InputPassword, InputRupiah, Label, Kolom, Textarea };
