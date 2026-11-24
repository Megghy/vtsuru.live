import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseUserIndexModel, ResponseUserInfo } from '@/api/generated/model'
import { getApiUserIndexGet } from '@/api/generated/user-index/user-index'
import type { BiliProfile } from '@/apps/user-page/types'
import { toast } from '@/shared/utils'
import { formatBiliLiveReserveTime } from '@/shared/utils/formatBiliLiveReserve'

export interface IndexTemplateProps {
  userInfo: ResponseUserInfo | undefined
  biliInfo: BiliProfile | undefined
}

export interface IndexProfileStat {
  label: string
  enLabel: string
  value: number
  text: string
}

function formatCount(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString()
}

export function useIndexTemplateData(props: IndexTemplateProps) {
  const accountInfo = useAccount()
  const isLoading = ref(true)
  const showHeaderImage = ref(true)
  const showAvatarFrame = ref(true)
  const indexInfo = ref<ResponseUserIndexModel>({ links: {}, videos: [], notification: '' })

  const hasBiliBinding = computed(() => !!props.userInfo?.biliId)
  const avatar = computed(() => {
    if (!hasBiliBinding.value) return ''
    return props.userInfo?.streamerInfo?.faceUrl || props.userInfo?.faceUrl || props.biliInfo?.face || ''
  })
  const headerImage = computed(
    () => props.biliInfo?.top_photo || props.biliInfo?.top_photo_v2 || props.userInfo?.streamerInfo?.coverUrl || '',
  )
  const avatarFrame = computed(() => {
    if (!hasBiliBinding.value) return ''
    return (
      props.biliInfo?.pendant?.image_enhance_frame ||
      props.biliInfo?.pendant?.image_enhance ||
      props.biliInfo?.pendant?.image ||
      ''
    )
  })
  const nameplateText = computed(() => props.biliInfo?.nameplate?.name || '')
  const honorText = computed(
    () =>
      props.biliInfo?.Official?.title ||
      props.biliInfo?.Official?.desc ||
      props.biliInfo?.official?.title ||
      props.biliInfo?.official?.desc ||
      props.biliInfo?.official_verify?.desc ||
      props.biliInfo?.vip?.label?.text ||
      '',
  )
  const level = computed(() => props.biliInfo?.level_info?.current_level ?? props.biliInfo?.level ?? '')
  const streamerName = computed(
    () => props.userInfo?.streamerInfo?.name || props.biliInfo?.name || props.userInfo?.name || '未命名主播',
  )
  const signature = computed(
    () => props.biliInfo?.sign || props.userInfo?.streamerInfo?.title || '在自己的频道里，认真生活，尽兴直播。',
  )
  const nameSizeClass = computed(() => {
    const width = Array.from(String(streamerName.value)).reduce(
      (total, char) => total + ((char.codePointAt(0) ?? 0) <= 0xff ? 1 : 2),
      0,
    )
    if (width > 24) return 'is-long'
    if (width > 14) return 'is-medium'
    return ''
  })
  const isOwner = computed(() => !!props.userInfo?.id && props.userInfo.id === accountInfo.value?.id)
  const isStreaming = computed(() => props.userInfo?.streamerInfo?.isStreaming === true)
  const liveReserve = computed(() => props.userInfo?.liveReserve)
  const liveReserveTimeText = computed(() =>
    liveReserve.value ? formatBiliLiveReserveTime(liveReserve.value.planStart) : '',
  )
  const liveReserveLabel = computed(() => {
    if (!liveReserve.value) return ''
    return `${liveReserveTimeText.value} · ${liveReserve.value.title}`
  })

  const profileStats = computed<IndexProfileStat[]>(() => {
    const values = [
      {
        label: '关注者',
        enLabel: 'FOLLOWERS',
        value: props.biliInfo?.fans ?? props.biliInfo?.follower ?? props.biliInfo?.follower_count,
      },
      {
        label: '投稿',
        enLabel: 'VIDEOS',
        value: props.biliInfo?.archive_count ?? props.biliInfo?.video,
      },
      {
        label: '获赞',
        enLabel: 'LIKES',
        value: props.biliInfo?.likes ?? props.biliInfo?.like_num,
      },
    ]
    return values
      .filter(
        (item): item is { label: string; enLabel: string; value: number } =>
          typeof item.value === 'number' && item.value > 0,
      )
      .map((item) => ({ ...item, text: formatCount(item.value) }))
  })

  const orderedLinks = computed<[string, string][]>(() => {
    const entries = Object.entries(indexInfo.value.links || {})
    if (!isOwner.value) return entries
    const order = accountInfo.value?.settings?.index?.linkOrder
    if (!order?.length) return entries
    const map = new Map(entries)
    const ordered = order.filter((key) => map.has(key)).map((key) => [key, map.get(key)!] as [string, string])
    const remaining = entries.filter(([key]) => !order.includes(key))
    return [...ordered, ...remaining]
  })

  const biliSpaceUrl = computed(() =>
    props.userInfo?.biliId ? `https://space.bilibili.com/${props.userInfo.biliId}` : '',
  )
  const liveRoomUrl = computed(() =>
    props.userInfo?.biliRoomId ? `https://live.bilibili.com/${props.userInfo.biliRoomId}` : '',
  )

  let loadSeq = 0
  async function loadIndexInfo(userName?: string) {
    const seq = ++loadSeq
    showHeaderImage.value = true
    showAvatarFrame.value = true
    if (!userName) {
      indexInfo.value = { links: {}, videos: [], notification: '' }
      isLoading.value = false
      return
    }
    isLoading.value = true
    try {
      const data = await getApiUserIndexGet({ id: userName })
      if (seq !== loadSeq) return
      if (data.code === 200) indexInfo.value = data.data
      else if (data.code === 404) indexInfo.value = { links: {}, videos: [], notification: '' }
      else toast.error(`无法获取主页数据: ${data.message}`)
    } catch (error) {
      if (seq === loadSeq) toast.error(`无法获取主页数据: ${error}`)
    } finally {
      if (seq === loadSeq) isLoading.value = false
    }
  }

  watch(
    () => props.userInfo?.name,
    (name) => {
      void loadIndexInfo(name)
    },
    { immediate: true },
  )

  function navigate(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return {
    accountInfo,
    isLoading,
    showHeaderImage,
    showAvatarFrame,
    indexInfo,
    hasBiliBinding,
    avatar,
    headerImage,
    avatarFrame,
    nameplateText,
    honorText,
    level,
    streamerName,
    signature,
    nameSizeClass,
    isOwner,
    isStreaming,
    liveReserve,
    liveReserveTimeText,
    liveReserveLabel,
    profileStats,
    orderedLinks,
    biliSpaceUrl,
    liveRoomUrl,
    navigate,
  }
}
