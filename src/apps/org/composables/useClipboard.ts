import { showErrorToast, showSuccessToast } from '@/shared/services/toast'

export function useClipboard() {
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      showSuccessToast('已复制到剪贴板')
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : '复制失败')
    }
  }
  return { copy }
}
