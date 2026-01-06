import { LazyStore } from '@tauri-apps/plugin-store'
import { acceptHMRUpdate, defineStore } from 'pinia'

export class StoreTarget<T> {
  constructor(key: string, target: LazyStore, defaultValue?: T) {
    this.target = target
    this.key = key
    this.defaultValue = defaultValue
  }

  protected target: LazyStore
  protected defaultValue: T | undefined

  protected key: string
  async set(value: T) {
    return this.target.set(this.key, value)
  }

  async get(): Promise<T | undefined> {
    const result = await this.target.get<T>(this.key)

    if (result === undefined && this.defaultValue !== undefined) {
      await this.set(this.defaultValue)
      return this.defaultValue
    }
    return result
  }

  async delete() {
    return this.target.delete(this.key)
  }
}

export const useTauriStore = defineStore('tauri', () => {
  const store = new LazyStore('vtsuru.data.json', {
    autoSave: true,
    defaults: {},
  })

  async function set(key: string, value: unknown) {
    await store.set(key, value)
  }

  async function get<T>(key: string) {
    return store.get<T>(key)
  }

  function getTarget<T>(key: string, defaultValue?: T) {
    return new StoreTarget<T>(key, store, defaultValue)
  }

  return {
    store,
    set,
    get,
    getTarget,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useTauriStore, import.meta.hot))
