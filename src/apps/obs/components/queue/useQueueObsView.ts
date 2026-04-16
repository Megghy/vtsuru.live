import { computed } from 'vue'
import { QueueFrom } from '@/api/api-models'
import type {
  ObsDisplayBadge,
  ObsDisplayCurrent,
  ObsDisplayFooterTag,
  ObsDisplayItem,
} from '@/apps/obs/components/shared/obsDisplay'
import type { ResponseQueueModel } from '@/api/api-models'
import { getGiftPaymentDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'
import { useQueueData } from './useQueueData'

function buildPaymentBadgeText(from: QueueFrom, item: Pick<ResponseQueueModel, 'giftPrice' | 'mysteryBoxName' | 'mysteryBoxPrice'>) {
  if (from === QueueFrom.Manual) {
    return '主播添加'
  }

  return getGiftPaymentDisplayMeta(item).compactText
}

export function useQueueObsView(currentId: string) {
  const data = useQueueData(currentId)

  const title = computed(() => '排队')
  const countText = computed(() => `已有 ${data.activeItems.value.length ?? 0} 人`)

  const current = computed<ObsDisplayCurrent>(() => {
    if (!data.progressing.value) {
      return {
        active: false,
        emptyText: '等待中',
      }
    }

    const badges: ObsDisplayBadge[] = []

    if (data.settings.value.showFanMadelInfo && (data.progressing.value.user?.fans_medal_level ?? 0) > 0) {
      badges.push({
        text: `${data.progressing.value.user?.fans_medal_name || ''} ${data.progressing.value.user?.fans_medal_level || ''}`.trim(),
        tone: 'muted',
      })
    }

    if (
      data.progressing.value.from === QueueFrom.Manual
      || data.settings.value.showPayment
      || (data.progressing.value.giftPrice ?? data.progressing.value.mysteryBoxPrice ?? 0) > 0
    ) {
      badges.push({
        text: buildPaymentBadgeText(data.progressing.value.from, data.progressing.value),
        tone: data.progressing.value.from === QueueFrom.Manual ? 'accent' : 'danger',
      })
    }

    return {
      active: true,
      title: data.progressing.value.user?.name || '未知用户',
      subtitle: data.progressing.value.from === QueueFrom.Manual ? '主播添加' : '处理中',
      avatarUrl: data.progressing.value.user?.face,
      hideAvatar: data.progressing.value.from === QueueFrom.Manual,
      emptyText: '等待中',
      badges,
    }
  })

  const items = computed<ObsDisplayItem[]>(() => {
    return data.activeItems.value.map(item => ({
      id: item.id,
      primary: item.user?.name || '未知用户',
      badges: [
        data.settings.value.showFanMadelInfo && (item.user?.fans_medal_level ?? 0) > 0
          ? {
              text: `${item.user?.fans_medal_name || ''} ${item.user?.fans_medal_level || ''}`.trim(),
              tone: 'muted',
            }
          : null,
        item.from === QueueFrom.Manual
          || data.settings.value.showPayment
          || (item.giftPrice ?? item.mysteryBoxPrice ?? 0) > 0
          ? {
              text: buildPaymentBadgeText(item.from, item),
              tone: item.from === QueueFrom.Manual ? 'accent' : 'danger',
            }
          : null,
      ].filter(Boolean) as NonNullable<ObsDisplayItem['badges']>,
    }))
  })

  const footerTags = computed<ObsDisplayFooterTag[]>(() => {
    if (!data.settings.value.showRequireInfo) {
      return []
    }
    return data.footerTags.value
  })

  return {
    ...data,
    title,
    countText,
    current,
    items,
    footerTags,
  }
}
