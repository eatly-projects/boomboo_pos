import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { LuChevronDown, LuCheck } from 'react-icons/lu';
import { cn } from '@/shared/lib/utils';

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-11 w-full items-center justify-between gap-2 rounded-xl border-2 border-netral-200 bg-white px-3 text-sm text-coklat-900',
      'focus:outline-none focus:border-boom-500 disabled:opacity-60',
      '[&>span]:truncate',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <LuChevronDown className="size-4 shrink-0 text-coklat-400" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position="popper"
      sideOffset={6}
      className={cn(
        'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border-2 border-netral-200 bg-white shadow-lg',
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-lg py-2.5 pl-3 pr-9 text-sm text-coklat-900 outline-none',
      'data-[highlighted]:bg-coklat-50 data-[state=checked]:font-semibold',
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-3 grid place-items-center">
      <SelectPrimitive.ItemIndicator>
        <LuCheck className="size-4 text-boom-500" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

/** Pemilihan sederhana dari daftar: [{nilai, label}] */
function Pilihan({ nilai, onUbah, daftar, placeholder = 'Pilih...', className }) {
  return (
    <Select value={nilai ?? ''} onValueChange={onUbah}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {daftar.map((d) => (
          <SelectItem key={d.nilai} value={d.nilai}>
            {d.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Pilihan };
