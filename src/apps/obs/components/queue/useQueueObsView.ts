import { computed, type MaybeRefOrGetter } from 'vue'

import type { ResponseQueueModel } from '@/api/client-types'
import { QueueFrom } from '@/api/generated/model'
import type {
  ObsDisplayBadge,
  ObsDisplayCurrent,
  ObsDisplayFooterTag,
  ObsDisplayItem,
} from '@/apps/obs/components/shared/obsDisplay'
import { getGiftPaymentDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'

import { useQueueData } from './useQueueData'

function buildPaymentBadgeText(
  from: QueueFrom,
  item: Pick<ResponseQueueModel, 'giftPrice' | 'mysteryBoxName' | 'mysteryBoxPrice'>,
) {
  if (from === QueueFrom.Manual) {
    return '主播添加'
  }
  if (from === QueueFrom.SC) {
    const meta = getGiftPaymentDisplayMeta(item)
    return meta.giftPriceText ? `SC ¥${meta.giftPriceText}` : 'SC'
  }

  return getGiftPaymentDisplayMeta(item).compactText
}

export function useQueueObsView(currentId: MaybeRefOrGetter<string | number | null | undefined>) {
  const data = useQueueData(currentId)

  const title = computed(() => (data.teamSize.value > 1 ? `排队 · ${data.teamSize.value}人车` : '排队'))
  const countText = computed(() => {
    const waiting = data.activeItems.value.length ?? 0
    if (data.teamSize.value > 1 && waiting > 0) {
      return `等待 ${waiting} 人 · ${Math.ceil(waiting / data.teamSize.value)} 车`
    }
    return `已有 ${waiting} 人`
  })

  const current = computed<ObsDisplayCurrent>(() => {
    const list = data.progressingList.value
    const size = data.teamSize.value
    if (list.length === 0) {
      return {
        active: false,
        emptyText: size > 1 ? '等待发车' : '等待中',
      }
    }

    if (list.length > 1) {
      const batchNo = list.reduce((max, item) => Math.max(max, item.batchNo ?? 0), 0)
      return {
        active: true,
        title: `本局车队（${list.length}/${size}）`,
        subtitle: batchNo > 0 ? `第 ${batchNo} 车进行中` : '车队进行中',
        hideAvatar: true,
        emptyText: '等待发车',
        members: list.map((member) => ({
          id: member.id,
          name: member.user?.name || '未知用户',
          subtitle: data.showContent.value ? member.content?.trim() || undefined : undefined,
        })),
      }
    }

    const first = list[0]
    const badges: ObsDisplayBadge[] = []

    if (data.settings.value.showFanMadelInfo && (first.user?.fans_medal_level ?? 0) > 0) {
      badges.push({
        text: `${first.user?.fans_medal_name || ''} ${first.user?.fans_medal_level || ''}`.trim(),
        tone: 'muted',
      })
    }

    if (
      first.from === QueueFrom.Manual ||
      first.from === QueueFrom.SC ||
      data.settings.value.showPayment ||
      (first.giftPrice ?? first.mysteryBoxPrice ?? 0) > 0
    ) {
      badges.push({
        text: buildPaymentBadgeText(first.from, first),
        tone: first.from === QueueFrom.Manual ? 'accent' : first.from === QueueFrom.SC ? 'warning' : 'danger',
      })
    }

    const note = data.showContent.value ? first.content?.trim() : ''
    return {
      active: true,
      title: first.user?.name || '未知用户',
      subtitle:
        note ||
        (size > 1
          ? `本局车队 (1/${size})`
          : first.from === QueueFrom.Manual
            ? '主播添加'
            : '处理中'),
      avatarUrl: first.user?.face,
      hideAvatar: first.from === QueueFrom.Manual,
      emptyText: size > 1 ? '等待发车' : '等待中',
      badges,
    }
  })

  const items = computed<ObsDisplayItem[]>(() => {
    const size = data.teamSize.value
    return data.activeItems.value.map((item, idx) => {
      const badges: ObsDisplayBadge[] = []
      if (size > 1 && idx < size) {
        badges.push({ text: '下一车', tone: 'success' })
      }
      if (data.settings.value.showFanMadelInfo && (item.user?.fans_medal_level ?? 0) > 0) {
        badges.push({
          text: `${item.user?.fans_medal_name || ''} ${item.user?.fans_medal_level || ''}`.trim(),
          tone: 'muted',
        })
      }
      if (
        item.from === QueueFrom.Manual ||
        item.from === QueueFrom.SC ||
        data.settings.value.showPayment ||
        (item.giftPrice ?? item.mysteryBoxPrice ?? 0) > 0
      ) {
        badges.push({
          text: buildPaymentBadgeText(item.from, item),
          tone: item.from === QueueFrom.Manual ? 'accent' : item.from === QueueFrom.SC ? 'warning' : 'danger',
        })
      }

      return {
        id: item.id,
        primary: item.user?.name || '未知用户',
        secondary: data.showContent.value ? item.content?.trim() || undefined : undefined,
        badges,
      }
    })
  })

  const footerTags = computed<ObsDisplayFooterTag[]>(() => {
    if (!data.settings.value.showRequireInfo) {
      return []
    }
    return data.footerTags.value
  })

  const shouldHide = computed(
    () =>
      data.hideWhenEmpty.value &&
      data.progressingList.value.length === 0 &&
      data.activeItems.value.length === 0,
  )

  return {
    ...data,
    title,
    countText,
    current,
    items,
    footerTags,
    shouldHide,
  }
}
