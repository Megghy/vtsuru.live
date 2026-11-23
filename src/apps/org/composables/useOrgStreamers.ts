import { computed, inject, provide, ref } from 'vue'
import type { InjectionKey } from 'vue'

import {
  getApiOrgOrgIdStreamers,
  getApiOrgOrgIdStreamersStreamerUserIdDetail,
  postApiOrgOrgIdStreamerRemove,
  postApiOrgOrgIdStreamerUpdate,
} from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { toast } from '@/shared/utils'

import type { OrgStreamerDetailModel, OrgStreamerItem, StreamerOption } from '../types'
import type { OrgContext } from './useOrgContext'

export function useOrgStreamers(ctx: OrgContext) {
  const streamers = ref<OrgStreamerItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const includeAll = ref(false)
  const search = ref('')

  const filtered = computed(() => {
    if (!search.value) return streamers.value
    const q = search.value.toLowerCase()
    return streamers.value.filter((s) => s.streamer.name.toLowerCase().includes(q) || String(s.streamer.id).includes(q))
  })

  const activeCount = computed(() => streamers.value.filter((s) => s.status === 1).length)

  const options = computed<StreamerOption[]>(() =>
    streamers.value
      .filter((s) => s.status === 1)
      .map((s) => ({ label: s.streamer.name, value: s.streamer.id })),
  )

  const pointManagedOptions = computed<StreamerOption[]>(() =>
    streamers.value
      .filter((s) => s.status === 1 && s.allowPointManage !== false)
      .map((s) => ({ label: s.streamer.name, value: s.streamer.id })),
  )

  async function load() {
    if (!ctx.orgId.value) return
    loading.value = true
    error.value = null
    try {
      const includeAllParam = ctx.isOrgAdmin.value ? includeAll.value : false
      streamers.value = unwrapOk(
        (await getApiOrgOrgIdStreamers(ctx.orgId.value, {
          includeAll: includeAllParam ? true : undefined,
        })) as any,
        '加载主播失败',
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载主播失败'
      error.value = msg
      toast.error(msg)
    } finally {
      loading.value = false
    }
  }

  async function remove(streamerUserId: number) {
    try {
      unwrapOk(
        (await postApiOrgOrgIdStreamerRemove(ctx.orgId.value, {
          targetStreamerUserId: streamerUserId,
        })) as any,
        '移除失败',
      )
      toast.success('已移除该主播')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移除失败')
    }
  }

  return { streamers, loading, error, includeAll, search, filtered, activeCount, options, pointManagedOptions, load, remove }
}

export type OrgStreamersStore = ReturnType<typeof useOrgStreamers>

const STREAMERS_KEY: InjectionKey<OrgStreamersStore> = Symbol('org-streamers')

export function provideOrgStreamers(ctx: OrgContext): OrgStreamersStore {
  const store = useOrgStreamers(ctx)
  provide(STREAMERS_KEY, store)
  return store
}

export function injectOrgStreamers(): OrgStreamersStore {
  const store = inject(STREAMERS_KEY)
  if (!store) throw new Error('injectOrgStreamers 必须在 provideOrgStreamers 之后调用')
  return store
}

export function useStreamerDetail(ctx: OrgContext) {
  const show = ref(false)
  const selectedId = ref<number | null>(null)
  const loading = ref(false)
  const detail = ref<OrgStreamerDetailModel | null>(null)
  const lives = ref<OrgStreamerDetailModel['lives']>([])
  const page = ref(1)
  const pageSize = ref(20)
  const days = ref(180)
  const hasMore = ref(false)

  const editNote = ref('')
  const saving = ref(false)

  function open(streamerUserId: number) {
    if (streamerUserId <= 0) return
    selectedId.value = streamerUserId
    show.value = true
  }

  async function load(reset: boolean) {
    if (!selectedId.value || !ctx.orgId.value) return
    if (reset) {
      detail.value = null
      lives.value = []
      page.value = 1
      hasMore.value = false
    }
    loading.value = true
    try {
      const data = unwrapOk(
        await getApiOrgOrgIdStreamersStreamerUserIdDetail(ctx.orgId.value, selectedId.value, {
          days: days.value,
          page: page.value,
          pageSize: pageSize.value,
        }),
        '加载失败',
      ) as OrgStreamerDetailModel
      detail.value = data
      lives.value = page.value === 1 ? data.lives || [] : [...lives.value, ...(data.lives || [])]
      if (typeof data.totalLives === 'number') {
        hasMore.value = lives.value.length < data.totalLives
      } else {
        hasMore.value = (data.lives?.length || 0) >= pageSize.value
      }
      editNote.value = data.note || ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    page.value += 1
    await load(false)
  }

  async function saveNote(onSaved?: () => Promise<void> | void) {
    if (!ctx.isOrgAdmin.value || !selectedId.value || !ctx.orgId.value) return
    saving.value = true
    try {
      unwrapOk(
        (await postApiOrgOrgIdStreamerUpdate(ctx.orgId.value, {
          targetStreamerUserId: selectedId.value,
          note: editNote.value,
        })) as any,
        '保存失败',
      )
      toast.success('备注已保存')
      await onSaved?.()
      await load(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      saving.value = false
    }
  }

  async function removeFromOrg(onSaved?: () => Promise<void> | void) {
    if (!ctx.isOrgAdmin.value || !selectedId.value || !ctx.orgId.value) return
    saving.value = true
    try {
      unwrapOk(
        (await postApiOrgOrgIdStreamerRemove(ctx.orgId.value, {
          targetStreamerUserId: selectedId.value,
        })) as any,
        '移除失败',
      )
      toast.success('已解除该主播绑定')
      await onSaved?.()
      await load(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移除失败')
    } finally {
      saving.value = false
    }
  }

  return {
    show,
    selectedId,
    loading,
    detail,
    lives,
    page,
    days,
    hasMore,
    editNote,
    saving,
    open,
    load,
    loadMore,
    saveNote,
    removeFromOrg,
  }
}
