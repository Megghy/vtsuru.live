import { QueryGetAPI } from '@/api/query'
import { useRequest } from 'vue-request'
import { NOTIFACTION_API_URL, isBackendUsable } from './constants'
import { NotifactionInfo } from '@/api/api-models'
import { useAccount } from '@/api/account'
import { ref } from 'vue'

const account = useAccount()
const n = ref<NotifactionInfo>()
let isLoading = false
function get() {
  if (isLoading) return
  QueryGetAPI<NotifactionInfo>(NOTIFACTION_API_URL + 'get')
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
export const GetNotifactions = () => {
  if (account) {
    setInterval(get, 5000)
  }
}
