import type { FunctionTypes } from '@/api/api-models'
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { DisableFunction, EnableFunction, useAccount } from '@/api/account'

/**
 * 统一封装「启用/禁用某个功能开关」的逻辑：调接口 + 本地 enableFunctions 列表同步 + toast。
 * 此前散落在 ManagePageHeader 及各功能页（提问箱/日程表/积分/视频征集）的同构 setFunctionEnable。
 */
export function useFunctionToggle(functionType: FunctionTypes, label: string) {
  const accountInfo = useAccount()
  const message = useMessage()
  const loading = ref(false)

  async function setEnable(enable: boolean) {
    loading.value = true
    try {
      const success = enable ? await EnableFunction(functionType) : await DisableFunction(functionType)
      if (!success) {
        message.error(`无法${enable ? '启用' : '禁用'}${label}功能`)
        return
      }
      message.success(`${label}功能已${enable ? '启用' : '禁用'}`)
      const list = accountInfo.value?.settings?.enableFunctions
      if (list) {
        const idx = list.indexOf(functionType)
        if (enable && idx < 0) list.push(functionType)
        else if (!enable && idx > -1) list.splice(idx, 1)
      }
    } catch (err) {
      message.error(`操作失败: ${String(err)}`)
    } finally {
      loading.value = false
    }
  }

  return { loading, setEnable }
}
