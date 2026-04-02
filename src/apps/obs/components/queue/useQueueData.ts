import type {
  ResponseQueueModel,
  Setting_Queue,
} from '@/api/api-models'
import { List } from 'linqts'
import { computed, ref } from 'vue'
import {
  QueueFrom,
  QueueSortType,
  QueueStatus,
} from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { QUEUE_API_URL } from '@/shared/config'

export function useQueueData(currentId: string) {
  const queue = ref<ResponseQueueModel[]>([])
  const settings = ref<Setting_Queue>({} as Setting_Queue)

  const progressing = computed(() => {
    return queue.value.find(item => item.status === QueueStatus.Progressing)
  })

  const activeItems = computed(() => {
    let list = new List(queue.value)
      .Where(item => item?.status === QueueStatus.Waiting)
      .OrderByDescending(item => item.from === QueueFrom.Manual)

    switch (settings.value.sortType) {
      case QueueSortType.TimeFirst: {
        list = list.OrderBy(item => item.createAt)
        break
      }
      case QueueSortType.GuardFirst: {
        list = list
          .OrderBy(item => (item.user?.guard_level == null || item.user.guard_level === 0 ? 4 : item.user.guard_level))
          .ThenBy(item => item.createAt)
        break
      }
      case QueueSortType.PaymentFist: {
        list = list.OrderByDescending(item => item.giftPrice ?? 0).ThenBy(item => item.createAt)
        break
      }
      case QueueSortType.FansMedalFirst: {
        list = list
          .OrderByDescending(item => (item.user?.fans_medal_wearing_status ? 1 : 0))
          .ThenByDescending(item => item.user?.fans_medal_level ?? 0)
          .ThenBy(item => item.createAt)
        break
      }
    }

    if (settings.value.isReverse) {
      list = list.Reverse()
    }

    list = list.OrderByDescending(item => (item.status === QueueStatus.Progressing ? 1 : 0))
    return list.ToArray()
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
        value: settings.value.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.value.length > 0 ? allowGuardTypes.value.join('/') : '无',
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
        value: settings.value.fanMedalMinLevel !== undefined && !settings.value.allowAllDanmaku
          ? settings.value.fanMedalMinLevel > 0
            ? `> ${settings.value.fanMedalMinLevel}`
            : '佩戴'
          : '无需',
      },
    ]
  })

  async function get() {
    try {
      const data = await QueryGetAPI<{ queue: ResponseQueueModel[], setting: Setting_Queue }>(
        `${QUEUE_API_URL}get-active-and-settings`,
        {
          id: currentId,
        },
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
    queue.value = result.queue.sort((a, b) => b.createAt - a.createAt)
    settings.value = result.setting
  }

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
