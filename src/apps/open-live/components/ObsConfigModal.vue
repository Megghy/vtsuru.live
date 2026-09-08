<script setup lang="ts">
import { Copy24Regular, Info24Filled, Open24Regular } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCollapse,
  NCollapseItem,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NLi,
  NModal,
  NRadioButton,
  NRadioGroup,
  NTooltip,
  NUl,
} from 'naive-ui'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import { CURRENT_HOST } from '@/shared/config'
import { copyToClipboard } from '@/shared/utils'

type ObsStyle = 'classic' | 'fresh' | 'minimal'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** OBS 页面相对路径, 如 obs/queue、obs/live-request、obs/music-request */
    obsPath: string
    userId?: number
    /** 是否显示样式与滚动速度配置 (音乐点歌等无需) */
    showStyleOptions?: boolean
    speed?: number
    styleType?: ObsStyle
    description?: string
  }>(),
  {
    showStyleOptions: true,
    speed: 1,
    styleType: 'classic',
    description: '将等待队列以及结果显示在 OBS 中。',
  },
)

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:speed', value: number): void
  (e: 'update:styleType', value: ObsStyle): void
}>()

const accountInfo = useAccount()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})
const speedModel = computed({
  get: () => props.speed,
  set: (value) => emit('update:speed', value),
})
const styleModel = computed({
  get: () => props.styleType,
  set: (value) => emit('update:styleType', value),
})

const effectiveUserId = computed(() => props.userId || accountInfo.value?.id || 0)

const obsUrl = computed(() => {
  const userId = effectiveUserId.value
  const params = new URLSearchParams()
  if (userId) {
    params.set('id', String(userId))
  }
  if (props.showStyleOptions) {
    params.set('style', styleModel.value)
    params.set('speed', String(speedModel.value))
  }
  if (accountInfo.value?.token) {
    params.set('token', accountInfo.value.token)
  }
  const base = CURRENT_HOST.endsWith('/') ? CURRENT_HOST : `${CURRENT_HOST}/`
  const cleanPath = props.obsPath.startsWith('/') ? props.obsPath.slice(1) : props.obsPath
  return `${base}${cleanPath}?${params.toString()}`
})
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    class="obs-config-modal"
    style="width: 880px; max-width: 95vw; max-height: 90vh"
    title="OBS 组件"
    closable
    content-style="overflow-y: auto; max-height: calc(90vh - 110px); padding: 16px 20px;"
  >
    <template #header-extra>
      <NButton
        tag="a"
        type="primary"
        size="small"
        target="_blank"
        :href="obsUrl"
      >
        <template #icon>
          <NIcon :component="Open24Regular" />
        </template>
        浏览
      </NButton>
    </template>

    <div class="obs-config-modal__body">
      <!-- 左侧：操作、链接与配置 -->
      <div class="obs-config-modal__main">
        <NAlert
          type="info"
          size="small"
          :bordered="false"
        >
          {{ description }}
        </NAlert>

        <!-- 核心区域：OBS 浏览器源链接与复制 -->
        <div class="obs-config-modal__section">
          <div class="obs-config-modal__section-title">OBS 浏览器源链接</div>
          <NInputGroup>
            <NInput
              :value="obsUrl"
              readonly
              placeholder="OBS 组件链接"
            />
            <NButton
              type="primary"
              :disabled="!obsUrl"
              @click="copyToClipboard(obsUrl)"
            >
              <template #icon>
                <NIcon :component="Copy24Regular" />
              </template>
              复制
            </NButton>
          </NInputGroup>
        </div>

        <!-- 样式与速度配置 -->
        <div
          v-if="showStyleOptions"
          class="obs-config-modal__section"
        >
          <div class="obs-config-modal__section-title">样式与速度</div>
          <NFlex
            vertical
            :size="10"
          >
            <NRadioGroup
              v-model:value="styleModel"
              name="obsStyle"
            >
              <NFlex
                :wrap="true"
                :size="8"
              >
                <NRadioButton value="classic">经典黑色</NRadioButton>
                <NRadioButton value="fresh">清新明亮</NRadioButton>
                <NRadioButton value="minimal">极简透明</NRadioButton>
              </NFlex>
            </NRadioGroup>
            <NFlex
              align="center"
              :size="8"
            >
              <NInputGroup class="obs-config-modal__speed-group">
                <NInputGroupLabel size="small">滚动速度</NInputGroupLabel>
                <NInputNumber
                  v-model:value="speedModel"
                  size="small"
                  :min="0.5"
                  :max="5"
                  :step="0.1"
                  placeholder="1"
                />
              </NInputGroup>
              <NTooltip>
                <template #trigger>
                  <NIcon
                    :component="Info24Filled"
                    class="obs-config-modal__info-icon"
                  />
                </template>
                数值越大滚动越快（0.5 ~ 5）
              </NTooltip>
            </NFlex>
          </NFlex>
        </div>

        <!-- 使用说明折叠 -->
        <NCollapse class="obs-config-modal__help">
          <NCollapseItem title="OBS 使用说明">
            <NUl style="padding-left: 18px; margin: 4px 0">
              <NLi>在 OBS 来源中添加一个新的「浏览器」源。</NLi>
              <NLi>将上方链接复制并粘贴到「URL」栏中。</NLi>
              <NLi>推荐初始尺寸：宽 280px，高 500px（可按实际直播布局自由缩放）。</NLi>
              <NLi>右侧可实时预览组件视觉效果，调整好风格后直接复制链接使用。</NLi>
            </NUl>
          </NCollapseItem>
        </NCollapse>
      </div>

      <!-- 右侧：实时预览 -->
      <div class="obs-config-modal__side">
        <div class="obs-config-modal__preview-label">实时预览 (280 × 500)</div>
        <div class="obs-config-modal__preview">
          <slot
            v-if="effectiveUserId"
            name="preview"
            :style-type="styleModel"
            :speed="speedModel"
          />
          <NEmpty
            v-else
            description="无法预览：未获取到用户信息"
            size="small"
            class="obs-config-modal__empty"
          />
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.obs-config-modal__body {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) 280px;
  gap: 24px;
  align-items: start;
}

@media (max-width: 720px) {
  .obs-config-modal__body {
    grid-template-columns: 1fr;
  }
}

.obs-config-modal__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.obs-config-modal__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.obs-config-modal__section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--vtsuru-fg);
}

.obs-config-modal__speed-group {
  width: 200px;
}

.obs-config-modal__info-icon {
  color: var(--vtsuru-fg-muted);
  cursor: help;
}

.obs-config-modal__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.obs-config-modal__preview-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.obs-config-modal__preview {
  height: 500px;
  width: 280px;
  position: relative;
  border: 1px dashed var(--vtsuru-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vtsuru-bg-muted);
}

.obs-config-modal__empty {
  padding-top: 140px;
}

.obs-config-modal__help {
  margin-top: 4px;
}
</style>
