import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { unwrapOk } from '@/api/query'

type ApiResponse<T> = { code: number, message?: string, data: T }

interface RunOptions {
  success?: string // 成功提示文案，不传则不提示
  fail?: string // 失败前缀，默认「操作失败」
}

/**
 * 统一封装 manage 页面里「调接口 + loading + 200 判定 + 成功/失败 toast」的重复模板。
 * 失败时返回 undefined，由调用方决定兜底值。
 */
export function useApiAction() {
  const message = useMessage()
  const loading = ref(false)

  async function run<T>(fn: () => Promise<ApiResponse<T>>, opts: RunOptions = {}): Promise<T | undefined> {
    const failPrefix = opts.fail ?? '操作失败'
    loading.value = true
    try {
      const data = unwrapOk(await fn(), failPrefix)
      if (opts.success) message.success(opts.success)
      return data
    } catch (err) {
      message.error(`${failPrefix}: ${err instanceof Error ? err.message : String(err)}`)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, run }
}
