import { copyToClipboard } from '@/shared/utils'

export function useClipboard() {
  async function copy(text: string) {
    copyToClipboard(text)
  }
  return { copy }
}
