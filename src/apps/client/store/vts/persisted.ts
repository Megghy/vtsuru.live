import type { Ref } from 'vue'
import { ref } from 'vue'

import type { StoreTarget } from '@/apps/client/store/useTauriStore'

export function persistedValue<T>(target: StoreTarget<T>, initial: T) {
  const value = ref(initial) as Ref<T>
  return {
    value,
    load: async () => {
      value.value = (await target.get()) ?? initial
    },
    save: async (next: T) => {
      value.value = next
      await target.set(next)
    },
  }
}

export function persistedList<T>(target: StoreTarget<T[]>, keyOf: (item: T) => string) {
  const base = persistedValue<T[]>(target, [])
  const list = base.value
  return {
    ...base,
    upsert: async (item: T) => {
      const idx = list.value.findIndex((x) => keyOf(x) === keyOf(item))
      await base.save(idx >= 0 ? list.value.with(idx, item) : [...list.value, item])
    },
    remove: async (key: string) => {
      await base.save(list.value.filter((x) => keyOf(x) !== key))
    },
  }
}
