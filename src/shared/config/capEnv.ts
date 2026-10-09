import type {} from 'cap-widget'

import { CAP_HASHWX_URL, CAP_WASM_URL } from './assets'

if (typeof window !== 'undefined') {
  window.CAP_CUSTOM_WASM_URL = CAP_WASM_URL
  window.CAP_CUSTOM_HASHWX_URL = CAP_HASHWX_URL
}
