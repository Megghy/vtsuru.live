import { QueryGetAPI } from '@/api/query'
import { useRequest } from 'vue-request'
import { NOTIFACTION_API_URL } from './constants'
import { NotifactionInfo } from '@/api/api-models'
import { useAccount } from '@/api/account'

const account = useAccount()
const { data, run } = useRequest(get, {
  errorRetryCount: 5,
  pollingInterval: 5000,
  pollingWhenHidden: false,
})
function get() {
  return QueryGetAPI<NotifactionInfo>(NOTIFACTION_API_URL + 'get')
}

export const notifactions = () => data
export const GetNotifactions = () => {
  if (account) {
    run()
  }
}
