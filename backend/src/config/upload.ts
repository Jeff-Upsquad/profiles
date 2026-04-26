// Centralized upload limits.
//
// 500 MB lets editors upload long-form reels and full-resolution video
// portfolio pieces. Enforced both client-side (immediate UX feedback) and
// server-side (signed URL refuses to issue if the requested upload exceeds
// it, and R2 itself rejects the PUT if Content-Length is forged).
//
// Note: this only applies to the presigned-URL upload path used by the
// portfolio. The legacy proxied upload at POST /upload/file is still capped
// at 50 MB by the express.raw body parser limit and is kept for small
// images/PDFs where direct-to-R2 isn't worth the round trip.

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
