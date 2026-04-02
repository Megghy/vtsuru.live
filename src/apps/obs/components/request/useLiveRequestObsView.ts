import { computed } from 'vue'
import { SongRequestFrom } from '@/api/api-models'
import type {
  ObsDisplayCurrent,
  ObsDisplayFooterTag,
  ObsDisplayItem,
} from '@/apps/obs/components/shared/obsDisplay'
import { useLiveRequestData } from './useLiveRequestData'

export function useLiveRequestObsView(currentId: string) {
  const data = useLiveRequestData(currentId)

  const title = computed(() => data.settings.value.obsTitle ?? '点播')
  const countText = computed(() => `已有 ${data.activeSongs.value.length ?? 0} 条`)

  const current = computed<ObsDisplayCurrent>(() => {
    if (!data.singing.value) {
      return {
        active: false,
        emptyText: '暂无处理中项目',
      }
    }

    return {
      active: true,
      title: data.singing.value.songName || '未知歌曲',
      subtitle: data.singing.value.from === SongRequestFrom.Manual ? '主播添加' : data.singing.value.user?.name || '未知用户',
      avatarUrl: data.singing.value.user?.face,
      hideAvatar: data.singing.value.from === SongRequestFrom.Manual,
      emptyText: '暂无处理中项目',
    }
  })

  const items = computed<ObsDisplayItem[]>(() => {
    return data.activeSongs.value.map(song => ({
      id: song.id,
      primary: song.songName || '未知歌曲',
      badges: [
        data.settings.value.showUserName
          ? {
              text: song.from === SongRequestFrom.Manual ? '主播添加' : song.user?.name || '未知用户',
              tone: song.from === SongRequestFrom.Manual ? 'accent' : 'muted',
            }
          : null,
        data.settings.value.showFanMadelInfo && (song.user?.fans_medal_level ?? 0) > 0
          ? {
              text: `${song.user?.fans_medal_name || ''} ${song.user?.fans_medal_level || ''}`.trim(),
              tone: 'muted',
            }
          : null,
      ].filter(Boolean) as NonNullable<ObsDisplayItem['badges']>,
    }))
  })

  const footerTags = computed<ObsDisplayFooterTag[]>(() => {
    if (!data.settings.value.showRequireInfo) {
      return []
    }

    return [
      {
        type: 'prefix',
        label: '前缀',
        value: data.settings.value.orderPrefix || '无',
      },
      {
        type: 'allow',
        label: '允许',
        value: data.settings.value.allowAllDanmaku ? '所有弹幕' : data.allowGuardTypes.value.length > 0 ? data.allowGuardTypes.value.join('/') : '无',
      },
      {
        type: 'sc',
        label: 'SC点歌',
        value: data.settings.value.allowSC ? `> ¥${data.settings.value.scMinPrice}` : '不允许',
      },
      {
        type: 'medal',
        label: '粉丝牌',
        value: data.settings.value.needWearFanMedal
          ? data.settings.value.fanMedalMinLevel > 0
            ? `> ${data.settings.value.fanMedalMinLevel}`
            : '佩戴'
          : '无需',
      },
    ]
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
