import type {} from 'cap-widget'

import { CAP_WASM_URL } from './assets'

if (typeof window !== 'undefined') {
  window.CAP_CUSTOM_WASM_URL = CAP_WASM_URL
}
