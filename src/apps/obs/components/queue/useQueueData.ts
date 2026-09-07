import { List } from 'linqts'
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { ResponseQueueModel, Setting_Queue } from '@/api/api-models'
import { QueueFrom, QueueStatus } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { QUEUE_API_URL } from '@/shared/config'
import { sortByQueueType } from '@/shared/utils/queue'

export function useQueueData(currentId: MaybeRefOrGetter<string | number | null | undefined>) {
  const queue = ref<ResponseQueueModel[]>([])
  const settings = ref<Setting_Queue>({} as Setting_Queue)

  const progressing = computed(() => {
    return queue.value.find((item) => item.status === QueueStatus.Progressing)
  })

  const activeItems = computed(() => {
    const waiting = queue.value.filter((item) => item?.status === QueueStatus.Waiting)
    const sorted = sortByQueueType(waiting, settings.value.sortType, settings.value.isReverse, {
      createAt: (q) => q.createAt,
      guardLevel: (q) => q.user?.guard_level,
      price: (q) => q.giftPrice,
      fansMedalLevel: (q) => q.user?.fans_medal_level,
      fansMedalWearing: (q) => q.user?.fans_medal_wearing_status,
    })
    return new List(sorted).OrderByDescending((item) => (item.from === QueueFrom.Manual ? 1 : 0)).ToArray()
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
    return [
      {
        type: 'keyword',
        label: '关键词',
        value: settings.value.keyword || '无',
      },
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
  })

  async function get() {
    try {
      const rawId = toValue(currentId)
      const idStr = rawId === undefined || rawId === null ? '' : String(rawId)
      const params = idStr ? { id: idStr } : {}

      const data = await QueryGetAPI<{ queue: ResponseQueueModel[]; setting: Setting_Queue }>(
        `${QUEUE_API_URL}get-active-and-settings`,
        params,
      )

      if (data.code === 200) {
        return data.data
      }
    } catch (err) {
      console.error(err)
    }

    return {
      queue: [],
      setting: {} as Setting_Queue,
    }
  }

  async function update() {
    const result = await get()
    queue.value = (result.queue ?? []).toSorted((a, b) => b.createAt - a.createAt)
    settings.value = result.setting ?? ({} as Setting_Queue)
  }

  watch(() => toValue(currentId), () => {
    void update()
  })

  return {
    queue,
    settings,
    progressing,
    activeItems,
    allowGuardTypes,
    footerTags,
    update,
  }
}
