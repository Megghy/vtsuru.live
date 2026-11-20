import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import type { APIFileModel } from '@/api/generated/model'
import { transformImageUrl } from '@/shared/services/imageTransform'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'

/** 各风格化日程模板共用的素材配置字段 */
export interface ScheduleTemplateAssetsConfig {
  backgroundFile: APIFileModel[]
  portraitFile?: APIFileModel[]
  showAvatar?: boolean
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

  const customPortraitUrl = computed(() => {
    const raw = effectiveConfig.value.portraitFile?.[0]?.path
    return raw ? transformImageUrl(raw, '960w_85q') : raw
  })
  const avatarUrl = computed(
    () => props.userInfo?.faceUrl || props.userInfo?.streamerInfo?.faceUrl || props.biliInfo?.face || '',
  )
  const portraitUrl = computed(
    () => customPortraitUrl.value || (effectiveConfig.value.showAvatar ? props.previewPortrait || avatarUrl.value : ''),
  )
  const backgroundUrl = computed(() => {
    const raw = effectiveConfig.value.backgroundFile[0]?.path
    return raw ? transformImageUrl(raw, '1920w_90q') : raw
  })
  /** 供模板 :style 直接绑定的背景图样式, 无背景时为 undefined */
  const backgroundImageStyle = computed(() =>
    backgroundUrl.value ? { backgroundImage: `url(${backgroundUrl.value})` } : undefined,
  )
  return { customPortraitUrl, avatarUrl, portraitUrl, backgroundUrl, backgroundImageStyle }
}
