import { GuardError } from "./access";
import type { PostPhoto } from "./actions";

// Telegram accepts a 10 MB photo upload. A browser can claim any content type,
// so the declared type only chooses the error message: what decides is the
// first bytes of the file.
export const PHOTO_LIMIT = 10 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoKind = (typeof PHOTO_TYPES)[number];

/** The format the bytes actually are, or null for anything we will not forward. */
export function photoKind(bytes: Uint8Array): PhotoKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/** A filename Telegram and our logs can hold: no path, no control characters, one extension. */
export function safeFilename(raw: unknown, kind: PhotoKind): string {
  const extension = kind === "image/jpeg" ? "jpg" : kind === "image/png" ? "png" : "webp";
  const base = typeof raw === "string" ? raw.split(/[\\/]/).pop() ?? "" : "";
  const cleaned = base.replace(/\.[^.]*$/, "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 60);
  return `${cleaned || "photo"}.${extension}`;
}

export async function readPhoto(value: FormDataEntryValue | null): Promise<PostPhoto | null> {
  if (!value || typeof value === "string") return null;
  if (value.size === 0) return null;
  if (value.size > PHOTO_LIMIT) throw new GuardError("حجم عکس بیش از ۱۰ مگابایت است.", 413);
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (bytes.length > PHOTO_LIMIT) throw new GuardError("حجم عکس بیش از ۱۰ مگابایت است.", 413);
  const kind = photoKind(bytes);
  if (!kind) throw new GuardError("فقط عکس JPEG، PNG یا WebP پذیرفته می‌شود.", 415);
  // Re-wrapped with the type we verified, so a mislabelled upload cannot travel further.
  return { blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: kind }), filename: safeFilename(value.name, kind) };
}
