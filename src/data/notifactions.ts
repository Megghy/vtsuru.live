import type { NotifactionInfo } from '@/api/api-models'
import { ref } from 'vue'
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { isBackendUsable, SONG_REQUEST_API_URL } from './constants'

const account = useAccount()
const n = ref<NotifactionInfo>()
let isLoading = false
function get() {
  if (isLoading) return
  QueryGetAPI<NotifactionInfo>(`${SONG_REQUEST_API_URL}get-active`)
    .then((data) => {
      if (data.code == 200) {
        n.value = data.data
        isBackendUsable.value = true
      }
    })
    .catch((err) => {
      isBackendUsable.value = false
    })
    .finally(() => {
      isLoading = false
    })
}

export const notifactions = () => n
export function GetNotifactions() {
  if (account) {
    // setInterval(get, 5000)
    // 暂时不用
  }
}
