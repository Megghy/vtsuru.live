import type { WritableComputedRef } from 'vue'
import type { LocationQueryRaw, LocationQueryValueRaw } from 'vue-router'
import { computed, nextTick, toValue } from 'vue'
import router from '@/app/router'

type QueryValue = LocationQueryValueRaw | LocationQueryValueRaw[]

interface RouteQueryParamTransform<T> {
  get?: (value: QueryValue) => T
  set?: (value: T) => QueryValue
}

interface RouteQueryParamOptions<T> {
  transform?: ((value: QueryValue) => T) | RouteQueryParamTransform<T>
}

const queryQueue = new Map<string, QueryValue>()
let queryFlushPending = false

function flushQueryQueue() {
  if (queryFlushPending) return
  queryFlushPending = true
  nextTick(() => {
    queryFlushPending = false
    if (queryQueue.size === 0) return

    const currentRoute = router.currentRoute.value
    const query: LocationQueryRaw = { ...currentRoute.query }
    queryQueue.forEach((value, key) => {
      if (value === undefined) {
        delete query[key]
      } else {
        query[key] = value
      }
    })
    queryQueue.clear()

    void router.replace({
      params: currentRoute.params,
      query,
      hash: currentRoute.hash,
    })
  })
}

export function useRouteQueryParam<T extends QueryValue>(
  name: string,
  defaultValue?: T,
  options: RouteQueryParamOptions<T> = {},
): WritableComputedRef<T> {
  const transform = options.transform
  const get = typeof transform === 'function'
    ? transform
    : transform?.get ?? ((value: QueryValue) => value as T)
  const set = typeof transform === 'object' && transform.set
    ? transform.set
    : ((value: T) => value)

  return computed({
    get() {
      const value = router.currentRoute.value.query[name]
      return get(value === undefined ? toValue(defaultValue) : value)
    },
    set(value) {
      const nextValue = set(value)
      queryQueue.set(name, nextValue === toValue(defaultValue) ? undefined : nextValue)
      flushQueryQueue()
    },
  })
}
