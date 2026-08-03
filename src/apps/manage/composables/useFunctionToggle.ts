import { ref } from 'vue'

import { DisableFunction, EnableFunction, useAccount } from '@/api/account'
import type { FunctionTypes } from '@/api/api-models'

/**
 * 统一封装「启用/禁用某个功能开关」的逻辑：调接口 + 本地 enableFunctions 列表同步 + toast。
 * 此前散落在 ManagePageHeader 及各功能页（提问箱/日程表/积分/视频征集）的同构 setFunctionEnable。
 */
export function useFunctionToggle(functionType: FunctionTypes, label: string) {
  const accountInfo = useAccount()
  const toast = useToast()
  const loading = ref(false)

  async function setEnable(enable: boolean) {
    loading.value = true
    try {
      const success = enable ? await EnableFunction(functionType) : await DisableFunction(functionType)
      if (!success) {
        toast.add({ title: `无法${enable ? '启用' : '禁用'}${label}功能`, color: 'error' })
        return
      }
      toast.add({ title: `${label}功能已${enable ? '启用' : '禁用'}`, color: 'success' })
      const list = accountInfo.value?.settings?.enableFunctions
      if (list) {
        const idx = list.indexOf(functionType)
        if (enable && idx < 0) list.push(functionType)
        else if (!enable && idx > -1) list.splice(idx, 1)
      }
    } catch (err) {
      toast.add({ title: `操作失败: ${String(err)}`, color: 'error' })
    } finally {
      loading.value = false
    }
  }

  return { loading, setEnable }
}
