const debugAPI = import.meta.env.VITE_DEBUG_API
const releseAPI = `${document.location.protocol}//api.vtsuru.live/`
export const BASE_API = process.env.NODE_ENV === 'development' ? debugAPI : releseAPI
export const FETCH_API = 'https://fetch.vtsuru.live/'

export const USER_URL = `${BASE_API}user/`
