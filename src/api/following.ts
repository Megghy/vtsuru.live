import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import {
  getApiFollowingDirectory,
  getApiFollowingStates,
  postApiFollowingId,
} from '@/api/generated/following/following'

import type { FollowingControllerDirectoryEntry } from '@/api/generated/model/followingControllerDirectoryEntry'
import type { FollowingControllerFollowState } from '@/api/generated/model/followingControllerFollowState'

import { ACCOUNT } from './account'
import { unwrapOk } from './query'
export type FollowState = FollowingControllerFollowState
export type LiveDirectoryEntry = FollowingControllerDirectoryEntry
export async function setFollowing(id: number, following: boolean) {
  unwrapOk(await postApiFollowingId(id, { following }), '关注操作失败')
}
export async function getDirectory(followingOnly: boolean, liveOnly: boolean, signal?: AbortSignal) {
  return unwrapOk(
    await getApiFollowingDirectory({ followingOnly, liveOnly }, { signal }),
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
      try {
        const result = unwrapOk(
          await getApiFollowingStates({ ids: targets }, { signal: controller.signal }),
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
