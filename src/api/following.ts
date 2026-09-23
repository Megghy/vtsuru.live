import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { BASE_API_URL } from '@/shared/config'

import { ACCOUNT } from './account'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from './query'

const endpoint = `${BASE_API_URL}following/`
export interface FollowState {
  id: number
  isFollowing: boolean
  followers: number
}
export interface LiveDirectoryEntry {
  id: number
  name: string
  avatar: string
  roomId: number
  title: string
  cover: string
  area: string
  status: 'live' | 'offline' | 'unknown'
  updatedAt: number
  isFollowing: boolean
}
export async function setFollowing(id: number, following: boolean) {
  unwrapOk(await QueryPostAPI(`${endpoint}${id}`, { following }), '关注操作失败')
}
export async function getDirectory(followingOnly: boolean, liveOnly: boolean, signal?: AbortSignal) {
  return unwrapOk(
    await QueryGetAPI<LiveDirectoryEntry[]>(`${endpoint}directory`, { followingOnly, liveOnly }, undefined, { signal }),
    '加载直播列表失败',
  )
}
export function useFollowingStates(ids: MaybeRefOrGetter<number[]>) {
  const states = ref<Record<number, FollowState>>({})
  const error = ref('')
  const revision = ref(0)
  watch(
    () => [toValue(ids), ACCOUNT.value.id, revision.value],
    async (_, __, onCleanup) => {
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      states.value = {}
      error.value = ''
      const targets = toValue(ids)
      if (!targets.length) return
      const params = new URLSearchParams()
      targets.forEach((id) => params.append('ids', String(id)))
      try {
        const result = unwrapOk(
          await QueryGetAPI<FollowState[]>(`${endpoint}states`, params, undefined, { signal: controller.signal }),
          '加载关注状态失败',
        )
        states.value = Object.fromEntries(result.map((state) => [state.id, state]))
      } catch (cause) {
        if (controller.signal.aborted) return
        error.value = (cause as Error).message
        throw cause
      }
    },
    { immediate: true },
  )
  return { states, error, refresh: () => revision.value++ }
}
