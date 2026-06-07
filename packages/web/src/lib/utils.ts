import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 格式化文件大小为人类可读的字符串（整数，无小数） */
export function formatFileSize(bytes: number): string {
  if (bytes < 0) return "0 B"
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${Math.round(mb)} MB`
  const gb = mb / 1024
  return `${Math.round(gb)} GB`
}
