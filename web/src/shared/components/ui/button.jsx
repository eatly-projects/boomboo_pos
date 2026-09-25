import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const gayaTombol = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-boom-500 focus-visible:ring-offset-2 active:scale-[0.98] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        utama: 'bg-boom-500 text-white hover:bg-boom-600 shadow-sm',
        garis: 'border-2 border-netral-200 bg-white text-coklat-900 hover:border-boom-500 hover:text-boom-600',
        halus: 'bg-coklat-50 text-coklat-900 hover:bg-coklat-100',
        polos: 'text-coklat-600 hover:bg-coklat-50 hover:text-coklat-900',
        hijau: 'bg-daun-500 text-white hover:bg-daun-700 shadow-sm',
        bahaya: 'bg-white text-boom-600 border-2 border-boom-200 hover:bg-boom-50',
      },
      ukuran: {
        kecil: 'h-9 px-3 text-sm [&_svg]:size-4',
        sedang: 'h-11 px-4 text-sm [&_svg]:size-4',
        besar: 'h-14 px-6 text-base [&_svg]:size-5',
        ikon: 'h-10 w-10 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'utama', ukuran: 'sedang' },
  }
);

const Button = React.forwardRef(
  ({ className, variant, ukuran, asChild = false, ...props }, ref) => {
    const Komponen = asChild ? Slot : 'button';
    return (
      <Komponen
        ref={ref}
        className={cn(gayaTombol({ variant, ukuran }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, gayaTombol };
