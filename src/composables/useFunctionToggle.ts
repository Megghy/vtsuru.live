import type { FunctionTypes } from '@/api/api-models'
import { SaveEnableFunctions, useAccount } from '@/api/account'

/**
 * 统一封装功能开关的启用/禁用: 乐观更新 + 失败回滚 + 成功/失败提示。
 * LiveRequest / Queue 等页面共用。
 */
export function useFunctionToggle(
  functionType: FunctionTypes,
  options?: {
    label?: string
    /** 启用前的钩子, 如设置默认关键词, 返回的设置会在保存开关前一并持久化 */
    onBeforeEnable?: () => void | Promise<void>
  },
) {
  const accountInfo = useAccount()
  const label = options?.label ?? '该功能'

  const enabled = computed(() => accountInfo.value?.settings.enableFunctions.includes(functionType) ?? false)

  async function toggle() {
    if (!accountInfo.value.id) return

    const isEnabling = !enabled.value
    const old = [...accountInfo.value.settings.enableFunctions]

    if (isEnabling) {
      await options?.onBeforeEnable?.()
      accountInfo.value.settings.enableFunctions.push(functionType)
    } else {
      accountInfo.value.settings.enableFunctions = old.filter(f => f != functionType)
    }

    try {
      const data = await SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
      if (data.code == 200) {
        window.$message.success(`已${isEnabling ? '启用' : '禁用'}${label}`)
      } else {
        accountInfo.value.settings.enableFunctions = old
        window.$message.error(`${label}${isEnabling ? '启用' : '禁用'}失败: ${data.message}`)
      }
    } catch (err: any) {
      accountInfo.value.settings.enableFunctions = old
      window.$message.error(`${label}${isEnabling ? '启用' : '禁用'}失败: ${err.message || err}`)
    }
  }

  return { enabled, toggle }
}
