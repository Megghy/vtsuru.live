import { computed, inject, provide, ref } from 'vue'
import type { InjectionKey } from 'vue'
import { useMessage } from 'naive-ui'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import type { OrgContext } from './useOrgContext'
import type { OrgStreamerDetailModel, OrgStreamerItem, StreamerOption } from '../types'

export function useOrgStreamers(ctx: OrgContext) {
  const message = useMessage()
  const streamers = ref<OrgStreamerItem[]>([])
  const loading = ref(false)
  const includeAll = ref(false)
  const search = ref('')

  const filtered = computed(() => {
    if (!search.value) return streamers.value
    const q = search.value.toLowerCase()
    return streamers.value.filter(s =>
      s.streamer.name.toLowerCase().includes(q) || String(s.streamer.id).includes(q),
    )
  })

  const options = computed<StreamerOption[]>(() =>
    streamers.value.map(s => ({ label: s.streamer.name, value: s.streamer.id })),
  )

  async function load() {
    if (!ctx.orgId.value) return
    loading.value = true
    try {
      const includeAllParam = ctx.isOrgAdmin.value ? includeAll.value : false
      streamers.value = unwrapOk(
        await QueryGetAPI<OrgStreamerItem[]>(`${ORG_API_URL}${ctx.orgId.value}/streamers`, {
          includeAll: includeAllParam ? true : undefined,
        }),
        '加载主播失败',
      )
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载主播失败')
    } finally {
      loading.value = false
    }
  }

  async function remove(streamerUserId: number) {
    try {
      unwrapOk(
        await QueryPostAPI(`${ORG_API_URL}${ctx.orgId.value}/streamer/remove`, { targetStreamerUserId: streamerUserId }),
        '移除失败',
      )
      message.success('移除成功')
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '移除失败')
    }
  }

  return { streamers, loading, includeAll, search, filtered, options, load, remove }
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
  const message = useMessage()
  const show = ref(false)
  const selectedId = ref<number | null>(null)
  const loading = ref(false)
  const detail = ref<OrgStreamerDetailModel | null>(null)
  const lives = ref<OrgStreamerDetailModel['lives']>([])
  const page = ref(1)
  const pageSize = ref(20)
  const hasMore = ref(false)

  const editStatus = ref<number | null>(null)
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
        await QueryGetAPI<OrgStreamerDetailModel>(
          `${ORG_API_URL}${ctx.orgId.value}/streamers/${selectedId.value}/detail`,
          { page: page.value, pageSize: pageSize.value },
        ),
        '加载失败',
      )
      detail.value = data
      lives.value = page.value === 1 ? (data.lives || []) : [...lives.value, ...(data.lives || [])]
      hasMore.value = (data.lives?.length || 0) >= pageSize.value
      editStatus.value = data.status
      editNote.value = data.note || ''
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    page.value += 1
    await load(false)
  }

  async function save(onSaved?: () => Promise<void> | void) {
    if (!ctx.isOrgAdmin.value || !selectedId.value || !ctx.orgId.value) return
    saving.value = true
    try {
      unwrapOk(
        await QueryPostAPI(`${ORG_API_URL}${ctx.orgId.value}/streamer/update`, {
          targetStreamerUserId: selectedId.value,
          status: editStatus.value ?? undefined,
          note: editNote.value,
        }),
        '保存失败',
      )
      message.success('已保存')
      await onSaved?.()
      await load(true)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      saving.value = false
    }
  }

  return {
    show, selectedId, loading, detail, lives, hasMore,
    editStatus, editNote, saving,
    open, load, loadMore, save,
  }
}
