import { acceptHMRUpdate, defineStore } from 'pinia'

import {
  persistedEntries,
  persistedFlush,
  persistedGetJson,
  persistedListKeys,
  persistedRemoveItem,
  persistedSetJson,
} from '@/shared/storage/persist'

export class StoreTarget<T> {
  constructor(key: string, defaultValue?: T) {
    this.key = key
    this.defaultValue = defaultValue
  }

  protected defaultValue: T | undefined
  protected key: string

  async set(value: T) {
    return persistedSetJson(this.key, value)
  }

  async get(): Promise<T | undefined> {
    const result = await persistedGetJson<T>(this.key)
    if (result === undefined && this.defaultValue !== undefined) {
      await this.set(this.defaultValue)
      return this.defaultValue
    }
    return result
  }

  async delete() {
    return persistedRemoveItem(this.key)
  }
}

export const useTauriStore = defineStore('tauri', () => {
  async function set(key: string, value: unknown) {
    await persistedSetJson(key, value)
  }

  async function get<T>(key: string) {
    return persistedGetJson<T>(key)
  }

  function getTarget<T>(key: string, defaultValue?: T) {
    return new StoreTarget<T>(key, defaultValue)
  }

  const store = {
    async save() {
      await persistedFlush()
    },
    async clear() {
      const keys = await persistedListKeys()
      await Promise.all(keys.map((key) => persistedRemoveItem(key)))
    },
    async set(key: string, value: unknown) {
      await persistedSetJson(key, value)
    },
    async delete(key: string) {
      await persistedRemoveItem(key)
    },
    async keys() {
      return persistedListKeys()
    },
    async entries<T = unknown>() {
      return persistedEntries() as Promise<[string, T][]>
    },
  }

  return {
    store,
    set,
    get,
    getTarget,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useTauriStore, import.meta.hot))
