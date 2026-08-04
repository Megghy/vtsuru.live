import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { rgbaToString } from '@/shared/types/VTsuruConfigTypes'

/** 各风格化日程模板共用的素材配置字段 */
export interface ScheduleTemplateAssetsConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  accentColor: RGBAColor
  showAvatar: boolean
}

/**
 * 收敛背景 / 立绘 / 头像的取值逻辑，供各风格化模板复用。
 * 立绘优先级: 自定义立绘 > 预览占位图 > 主播头像(受 showAvatar 控制)。
 */
export function useScheduleTemplateAssets<T extends ScheduleTemplateAssetsConfig>(
  props: ScheduleConfigTypeWithConfig<T>,
  config: MaybeRefOrGetter<T>,
) {
  const effectiveConfig = computed(() => toValue(config))

  const customPortraitUrl = computed(() => effectiveConfig.value.portraitFile[0]?.path)
  const avatarUrl = computed(
    () => props.userInfo?.faceUrl || props.userInfo?.streamerInfo?.faceUrl || props.biliInfo?.face || '',
  )
  const portraitUrl = computed(
    () => customPortraitUrl.value || props.previewPortrait || (effectiveConfig.value.showAvatar ? avatarUrl.value : ''),
  )
  const backgroundUrl = computed(() => effectiveConfig.value.backgroundFile[0]?.path)
  const accentColor = computed(() => rgbaToString(effectiveConfig.value.accentColor))

  return { customPortraitUrl, avatarUrl, portraitUrl, backgroundUrl, accentColor }
}
