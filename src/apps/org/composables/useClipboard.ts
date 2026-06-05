import { useMessage } from 'naive-ui'

export function useClipboard() {
  const message = useMessage()
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制到剪贴板')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '复制失败')
    }
  }
  return { copy }
}
