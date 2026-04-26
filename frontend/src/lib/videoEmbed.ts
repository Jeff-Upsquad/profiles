// Thin re-export of the canonical parser from the shared workspace, so the
// frontend can import it via the @/ alias. The actual logic lives in
// shared/src/videoEmbed.ts and is also consumed by the backend.
export {
  parseVideoUrl,
  SUPPORTED_PROVIDERS,
  PROVIDER_DISPLAY_NAME,
  legacyProviderDisplayName,
  type VideoProvider,
  type ParsedVideo,
} from '../../../shared/src/videoEmbed';
