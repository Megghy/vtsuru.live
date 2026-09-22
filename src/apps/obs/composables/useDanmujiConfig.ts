import { computed, onMounted, onUnmounted, ref } from 'vue'
import { DownloadConfig, GetConfigHash } from '@/api/account'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { normalizeDanmujiConfig, type DanmujiConfig } from '@/shared/danmujiConfig'
import { normalizeDanmujiStyle } from '@/shared/danmujiStyle'

export function useDanmujiConfig(props: { preview: boolean; config?: DanmujiConfig }) {
  const cloud = ref(normalizeDanmujiConfig())
  const query = Object.fromEntries(
    ['preset', 'opacity', 'fontSize', 'reverse', 'autoHide', 'pinned', 'pinnedMinPrice'].map(key => [key, useRouteQueryParam(key)]),
  )
  const config = computed(() => {
    const base = props.config ?? cloud.value
    if (props.preview) return base
    const overrides: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(query)) {
      if (value.value === undefined) continue
      if (key === 'reverse' || key === 'pinned') {
        if (value.value === 'true' || value.value === 'false') overrides[key] = value.value === 'true'
      } else overrides[key] = key === 'preset' ? value.value : Number(value.value)
    }
    return { ...base, style: normalizeDanmujiStyle({ ...base.style, ...overrides }) }
  })
  let hash: string | null | undefined
  let timer: ReturnType<typeof setTimeout>
  let disposed = false

  async function refresh() {
    try {
      const nextHash = await GetConfigHash('danmuji-config')
      if (nextHash !== hash) {
        const result = await DownloadConfig<unknown>('danmuji-config')
        if (result.status === 'success') cloud.value = normalizeDanmujiConfig(result.data)
        else if (result.status === 'notfound') cloud.value = normalizeDanmujiConfig()
        else throw new Error(result.msg || '读取弹幕姬配置失败')
        hash = nextHash
      }
    } finally {
      // 串行轮询，慢请求不会重叠；失败不推进哈希，下个周期仍会读取。
      if (!disposed) timer = setTimeout(refresh, 5000)
    }
  }

  onMounted(() => { if (!props.preview) return refresh() })
  onUnmounted(() => { disposed = true; clearTimeout(timer) })
  return config
}
