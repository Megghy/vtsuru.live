import type { InjectionKey, Ref } from 'vue'
import { inject, provide, shallowReadonly } from 'vue'

import type { UserPagesSettings } from '../types'

export type PublicUserPageStatus = 'idle' | 'loading' | 'not-found' | 'error' | 'ready'

export interface PublicUserPageRuntime {
  settings: Readonly<Ref<UserPagesSettings | null>>
  status: Readonly<Ref<PublicUserPageStatus>>
  error: Readonly<Ref<Error | null>>
  retry: () => void
}

const PUBLIC_USER_PAGE_RUNTIME_KEY: InjectionKey<PublicUserPageRuntime> = Symbol('public-user-page-runtime')

export function providePublicUserPageRuntime(runtime: {
  settings: Ref<UserPagesSettings | null>
  status: Ref<PublicUserPageStatus>
  error: Ref<Error | null>
  retry: () => void
}) {
  provide(PUBLIC_USER_PAGE_RUNTIME_KEY, {
    settings: shallowReadonly(runtime.settings),
    status: shallowReadonly(runtime.status),
    error: shallowReadonly(runtime.error),
    retry: runtime.retry,
  })
}

export function usePublicUserPageRuntime() {
  const runtime = inject(PUBLIC_USER_PAGE_RUNTIME_KEY)
  if (!runtime) throw new Error('公开用户页运行时未初始化')
  return runtime
}
