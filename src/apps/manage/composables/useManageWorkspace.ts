import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePersistedStorage } from '@/shared/storage/persist'

export type ManageWorkspace = 'streamer' | 'user'

const DEFAULT_ROUTES: Record<ManageWorkspace, string> = {
  streamer: '/manage',
  user: '/manage/user/points',
}

export function useManageWorkspace() {
  const route = useRoute()
  const router = useRouter()
  const lastRoutes = usePersistedStorage<Partial<Record<ManageWorkspace, string>>>('vtsuru:manage:workspace-routes', {})

  const workspace = computed<ManageWorkspace>(() => (route.meta.workspace === 'user' ? 'user' : 'streamer'))

  watch(
    () => [workspace.value, route.fullPath] as const,
    ([currentWorkspace, fullPath]) => {
      const url = new URL(fullPath, window.location.origin)
      url.hash = ''
      url.searchParams.delete('auth')
      url.searchParams.delete('token')
      lastRoutes.value = { ...lastRoutes.value, [currentWorkspace]: `${url.pathname}${url.search}` }
    },
    { immediate: true },
  )

  async function switchWorkspace(target: ManageWorkspace) {
    if (target === workspace.value) return
    const savedPath = lastRoutes.value?.[target]
    const destination = savedPath ? router.resolve(savedPath) : undefined
    const destinationWorkspace = destination?.meta.workspace === 'user' ? 'user' : 'streamer'
    await router.push(destination && destinationWorkspace === target ? destination.fullPath : DEFAULT_ROUTES[target])
  }

  return { workspace, switchWorkspace }
}
