import { useMessage } from 'naive-ui'

export function useVtsAction() {
  const message = useMessage()

  async function run<T>(fn: () => T | Promise<T>, successMsg?: string): Promise<T | undefined> {
    try {
      const result = await fn()
      if (successMsg) message.success(successMsg)
      return result
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }

  return { run, message }
}
