import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { LuX } from 'react-icons/lu';
import { cn } from '@/shared/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogContent = React.forwardRef(({ className, children, judul, keterangan, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-coklat-900/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Di HP muncul dari bawah layar (lebih gampang dijangkau jempol),
        // di layar lebar muncul di tengah.
        'fixed z-50 flex flex-col bg-white shadow-xl',
        'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl',
        'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-full sm:max-w-lg',
        'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4 border-b-2 border-netral-200 p-4 sm:p-5">
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-base font-bold text-coklat-900 sm:text-lg">
            {judul}
          </DialogPrimitive.Title>
          {keterangan && (
            <DialogPrimitive.Description className="mt-0.5 text-sm text-coklat-400">
              {keterangan}
            </DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close
          aria-label="Tutup"
          className="shrink-0 rounded-lg p-2 text-coklat-400 transition-colors hover:bg-coklat-50 hover:text-coklat-900"
        >
          <LuX className="size-4" />
        </DialogPrimitive.Close>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 -mx-4 -mb-4 mt-5 flex flex-col-reverse gap-2 border-t-2 border-netral-200 bg-white p-4 sm:-mx-5 sm:-mb-5 sm:flex-row sm:justify-end sm:p-5',
        className
      )}
      {...props}
    />
  );
}

export { Dialog, DialogTrigger, DialogContent, DialogClose, DialogFooter };
