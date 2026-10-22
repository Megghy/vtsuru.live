import { CAP_HASHWX_URL, CAP_WASM_URL } from './assets'

declare global {
  interface Window {
    CAP_CUSTOM_WASM_URL?: string
    CAP_CUSTOM_HASHWX_URL?: string
  }
}

if (typeof window !== 'undefined') {
  window.CAP_CUSTOM_WASM_URL = CAP_WASM_URL
  window.CAP_CUSTOM_HASHWX_URL = CAP_HASHWX_URL
}
