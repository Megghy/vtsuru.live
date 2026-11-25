import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { ResponseQueueModel } from '@/api/client-types'
import type { SettingQueue } from '@/api/generated/model'
import { QueueStatus } from '@/api/generated/model'
import { getApiQueueGetActiveAndSettings } from '@/api/generated/queue/queue'
import { parsePositiveId } from '@/shared/obs/obsUrl'
import { normalizeTimestampMs, sortByQueueType } from '@/shared/utils/queue'

export function useQueueData(currentId: MaybeRefOrGetter<string | number | null | undefined>) {
  const queue = ref<ResponseQueueModel[]>([])
  const settings = ref<SettingQueue>({} as SettingQueue)

  const teamSize = computed(() => {
    const raw = Number(settings.value.teamSize ?? 1)
    if (!Number.isFinite(raw)) return 1
    return Math.max(1, Math.min(20, Math.round(raw)))
  })

  const showContent = computed(() => settings.value.showContent !== false)
  const hideWhenEmpty = computed(() => settings.value.hideWhenEmpty === true)

  const progressingList = computed(() => {
    return queue.value
      .filter((item) => item.status === QueueStatus.Progressing)
      .toSorted(
        (a, b) =>
          (normalizeTimestampMs(a.startAt) || normalizeTimestampMs(a.createAt)) -
          (normalizeTimestampMs(b.startAt) || normalizeTimestampMs(b.createAt)),
      )
  })

  const progressing = computed(() => progressingList.value[0])

  const activeItems = computed(() => {
    const waiting = queue.value.filter((item) => item?.status === QueueStatus.Waiting)
    return sortByQueueType(waiting, settings.value.sortType, settings.value.isReverse, {
      createAt: (q) => q.createAt,
      guardLevel: (q) => q.user?.guard_level,
      price: (q) => q.giftPrice,
      fansMedalLevel: (q) => q.user?.fans_medal_level,
      fansMedalWearing: (q) => q.user?.fans_medal_wearing_status,
      priorityLevel: (q) => q.priorityLevel,
      sortOrder: (q) => q.sortOrder,
      isPinned: (q) => q.isPinned,
    })
  })

  const allowGuardTypes = computed(() => {
    const types: string[] = []
    if (settings.value.needTidu) {
      types.push('提督')
    }
    if (settings.value.needZongdu) {
      types.push('总督')
    }
    if (settings.value.needJianzhang) {
      types.push('舰长')
    }
    return types
  })

  const footerTags = computed(() => {
    const tags = [
      {
        type: 'keyword',
        label: '关键词',
        value: settings.value.keyword || '无',
      },
      ...(teamSize.value > 1
        ? [
            {
              type: 'allow',
              label: '车队',
              value: `每车 ${teamSize.value} 人`,
            },
          ]
        : []),
      {
        type: 'allow',
        label: '允许',
        value: settings.value.allowAllDanmaku
          ? '所有弹幕'
          : allowGuardTypes.value.length > 0
            ? allowGuardTypes.value.join('/')
            : '无',
      },
      {
        type: 'gift',
        label: '礼物',
        value: settings.value.allowGift ? '允许' : '不允许',
      },
      ...(settings.value.allowSC
        ? [
            {
              type: 'sc',
              label: 'SC',
              value: (settings.value.minSCPrice ?? 0) > 0 ? `≥ ¥${settings.value.minSCPrice}` : '任意',
            },
          ]
        : []),
      {
        type: 'price',
        label: '最低价格',
        value: settings.value.minGiftPrice ? `> ¥${settings.value.minGiftPrice}` : '任意',
      },
      {
        type: 'gift-names',
        label: '礼物名',
        value: settings.value.giftNames?.length ? settings.value.giftNames.join(', ') : '无',
      },
      {
        type: 'medal',
        label: '粉丝牌',
        value:
          settings.value.fanMedalMinLevel !== undefined && !settings.value.allowAllDanmaku
            ? settings.value.fanMedalMinLevel > 0
              ? `> ${settings.value.fanMedalMinLevel}`
              : '佩戴'
            : '无需',
      },
    ]
    return tags
  })

  async function get() {
    try {
      const validId = parsePositiveId(toValue(currentId))
      const params = validId ? { id: Number(validId) } : {}

      const data = await getApiQueueGetActiveAndSettings(params)

      if (data.code === 200) {
        return data.data
      }
    } catch (err) {
      console.error(err)
    }

    return {
      queue: [],
      setting: {} as SettingQueue,
    }
  }

  let requestSeq = 0

  async function update() {
    const seq = ++requestSeq
    const result = await get()
    if (seq !== requestSeq) return
    queue.value = (result.queue ?? []).toSorted(
      (a, b) => normalizeTimestampMs(b.createAt) - normalizeTimestampMs(a.createAt),
    )
    settings.value = result.setting ?? ({} as SettingQueue)
  }

  watch(
    () => toValue(currentId),
    () => {
      void update()
    },
  )

  return {
    queue,
    settings,
    teamSize,
    showContent,
    hideWhenEmpty,
    progressingList,
    progressing,
    activeItems,
    allowGuardTypes,
    footerTags,
    update,
  }
}
