import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Menggabungkan kelas Tailwind sambil membuang yang bentrok. */
export function cn(...kelas) {
  return twMerge(clsx(kelas));
}
