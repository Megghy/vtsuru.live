import { QueryGetAPI } from '@/api/query'
import { useRequest } from 'vue-request'
import { NOTIFACTION_API_URL } from './constants'
import { NotifactionInfo } from '@/api/api-models'
import { useAccount } from '@/api/account'

const account = useAccount()
const { data, loading, run } = useRequest(
  () => {
    return QueryGetAPI<NotifactionInfo>(NOTIFACTION_API_URL + 'get')
  },
  {
    errorRetryCount: 5,
    pollingInterval: 5000,
    pollingWhenHidden: false,
  }
)

export const notifactions = () => data
export const GetNotifactions = () => {
  if (account) {
    run()
  }
}
