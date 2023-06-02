const debugAPI = `${process.env.VITE_debugAPI}/api/`
const releseAPI = `${document.location.protocol}//api.vtsuru.live/api/`;
export const BASE_API = process.env.NODE_ENV === 'development' ? debugAPI : releseAPI;