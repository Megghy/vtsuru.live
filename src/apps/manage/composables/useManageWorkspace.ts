import { computed, watch } from 'vue'
import { useRoute, useRouter, type RouteMeta } from 'vue-router'

import { usePersistedStorage } from '@/shared/storage/persist'

export type ManageWorkspace = NonNullable<RouteMeta['workspace']>

export const WORKSPACE_LABELS: Record<ManageWorkspace, string> = {
  streamer: '主播后台',
  user: '用户中心',
}

const DEFAULT_ROUTES: Record<ManageWorkspace, string> = {
  streamer: '/manage',
  user: '/manage/user/points',
}

function workspaceOf(path: { meta: RouteMeta }): ManageWorkspace {
  return path.meta.workspace === 'user' ? 'user' : 'streamer'
}

function isManagePath(path: string) {
  return path === '/manage' || path.startsWith('/manage/')
}

export function useManageWorkspace() {
  const route = useRoute()
  const router = useRouter()
  const lastRoutes = usePersistedStorage<Partial<Record<ManageWorkspace, string>>>('vtsuru:manage:workspace-routes', {})
  const lastWorkspace = usePersistedStorage<ManageWorkspace>('vtsuru:manage:workspace', 'streamer')

  const workspace = computed<ManageWorkspace>(() => workspaceOf(route))

  watch(
    () => [workspace.value, route.fullPath] as const,
    ([currentWorkspace, fullPath]) => {
      if (!isManagePath(route.path)) return
      const url = new URL(fullPath, window.location.origin)
      url.hash = ''
      url.searchParams.delete('auth')
      url.searchParams.delete('token')
      lastWorkspace.value = currentWorkspace
      lastRoutes.value = { ...lastRoutes.value, [currentWorkspace]: `${url.pathname}${url.search}` }
    },
    { immediate: true },
  )

  function pathFor(target: ManageWorkspace) {
    const savedPath = lastRoutes.value?.[target]
    const destination = savedPath ? router.resolve(savedPath) : undefined
    const destinationWorkspace = destination ? workspaceOf(destination) : undefined
    return destination && destinationWorkspace === target ? destination.fullPath : DEFAULT_ROUTES[target]
  }

  async function switchWorkspace(target: ManageWorkspace) {
    if (target === workspace.value && isManagePath(route.path)) return
    await router.push(pathFor(target))
  }

  function enterLastWorkspace() {
    return router.push(pathFor(lastWorkspace.value))
  }

  return { workspace, lastWorkspace, switchWorkspace, enterLastWorkspace }
}
