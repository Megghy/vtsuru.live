/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />
interface ImportMeta {
  env: {
    VITE_DEBUG_DEV_API?: string
    VITE_DEBUG_RELEASE_API?: string
    VITE_API?: string
  }
}
