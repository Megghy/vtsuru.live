export function useVtsAction() {
  const toast = useToast()

  async function run<T>(fn: () => T | Promise<T>, successMsg?: string): Promise<T | undefined> {
    try {
      const result = await fn()
      if (successMsg) toast.add({ title: successMsg, color: 'success' })
      return result
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : String(err), color: 'error' })
    }
  }

  return { run }
}
