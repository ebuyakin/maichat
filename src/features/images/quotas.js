// Image quotas and sizing policy (Phase 3)
// Centralized constants; not user-configurable (v1)

export const IMAGE_QUOTAS = {
  MAX_IMAGES_PER_MESSAGE: 4, // hard cap
  MAX_TOTAL_BYTES_PER_MESSAGE: 30 * 1024 * 1024, // 30 MB
  MAX_IMAGE_STORE_BYTES: 400 * 1024 * 1024, // 400 MB total
  WARN_THRESHOLD_RATIO: 0.8, // 80% soft warning threshold
}

export const IMAGE_INGEST = {
  MAX_LONGEST_EDGE_PX: 2048,
  JPEG_QUALITY: 0.8,
}

export const IMAGE_SUPPORTED_FORMATS = new Set(['image/jpeg', 'image/png', 'image/webp'])

// Future: attempt HEIC to JPEG conversion where supported; otherwise reject with guidance
export const IMAGE_HEIC_MIME = 'image/heic'
