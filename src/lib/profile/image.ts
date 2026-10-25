export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageValidation =
  | { ok: true; contentType: "image/png" | "image/jpeg" | "image/webp"; extension: "png" | "jpg" | "webp" }
  | { ok: false; reason: "size" | "type" };

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export function validateProfileImage(input: {
  type: string;
  size: number;
  bytes: Uint8Array;
}): ImageValidation {
  if (input.size <= 0 || input.size > MAX_PROFILE_IMAGE_BYTES) {
    return { ok: false, reason: "size" };
  }
  const declared = input.type.toLowerCase();
  if (declared === "image/png" && hasPrefix(input.bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, contentType: "image/png", extension: "png" };
  }
  if (declared === "image/jpeg" && hasPrefix(input.bytes, [0xff, 0xd8, 0xff])) {
    return { ok: true, contentType: "image/jpeg", extension: "jpg" };
  }
  if (declared === "image/webp" && isWebp(input.bytes)) {
    return { ok: true, contentType: "image/webp", extension: "webp" };
  }
  return { ok: false, reason: "type" };
}
