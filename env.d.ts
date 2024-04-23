/// <reference types="vite/client" />
interface ImportMeta {
  env: {
    VITE_DEBUG_DEV_API?: string
    VITE_DEBUG_RELEASE_API?: string
    VITE_API?: string
  }
}
