<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import { NAlert, NButton, NCollapse, NCollapseItem, NDivider, NEmpty, NFlex, NIcon, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NLi, NModal, NRadioButton, NRadioGroup, NTooltip, NUl } from 'naive-ui';
import { computed } from 'vue'
import QueueOBS from '@/apps/obs/pages/QueueOBS.vue'
import { CURRENT_HOST } from '@/shared/config'
import { copyToClipboard } from '@/shared/utils'

const props = defineProps<{
  show: boolean
  userId?: number
  speed: number
  style: 'classic' | 'fresh' | 'minimal'
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:speed', value: number): void
  (e: 'update:style', value: 'classic' | 'fresh' | 'minimal'): void
}>()

const showModel = computed({
  get: () => props.show,
  set: value => emit('update:show', value),
})

const speedModel = computed({
  get: () => props.speed,
  set: value => emit('update:speed', value),
})

const styleModel = computed({
  get: () => props.style,
  set: value => emit('update:style', value),
})

const previewUrl = computed(() => {
  if (!props.userId) return ''
  return `${CURRENT_HOST}obs/queue?id=${props.userId}&style=${styleModel.value}&speed=${speedModel.value}`
})
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    style="width: 900px; max-width: 90vw"
    title="OBS组件"
    closable
  >
    <template #header-extra>
      <NButton
        tag="a"
        type="primary"
        size="small"
        target="_blank"
        :href="previewUrl"
      >
        浏览
      </NButton>
    </template>
    <NFlex vertical :size="12">
      <NAlert title="这是什么？" type="info" size="small" :bordered="false">
        将等待队列显示在 OBS 中，并可像点播组件一样切换不同视觉风格。
      </NAlert>

      <NDivider style="margin: 0">
        样式与速度
      </NDivider>
      <NFlex align="center" :wrap="true" :size="12">
        <NRadioGroup
          v-model:value="styleModel"
          name="queueObsStyle"
        >
          <NFlex :wrap="true">
            <NRadioButton value="classic">
              经典黑色风格
            </NRadioButton>
            <NRadioButton value="fresh">
              清新明亮风格
            </NRadioButton>
            <NRadioButton value="minimal">
              极简无背景
            </NRadioButton>
          </NFlex>
        </NRadioGroup>

        <NInputGroup class="queue-obs-modal__speed-group">
          <NInputGroupLabel>滚动速度倍率</NInputGroupLabel>
          <NInputNumber
            v-model:value="speedModel"
            :min="0.5"
            :max="5"
            :step="0.1"
            placeholder="1"
          />
        </NInputGroup>
        <NTooltip>
          <template #trigger>
            <NIcon :component="Info24Filled" />
          </template>
          数值越大滚动越快（0.5 ~ 5）
        </NTooltip>
      </NFlex>

      <NDivider style="margin: 0">
        预览
      </NDivider>
      <div class="queue-obs-modal__preview">
        <QueueOBS
          v-if="userId"
          :id="userId"
          :key="`${userId}-${styleModel}-${speedModel}`"
          :style="styleModel"
          :speed-multiplier="speedModel"
        />
        <NEmpty
          v-else
          description="无法预览：未获取到用户信息"
          size="small"
          class="queue-obs-modal__empty"
        />
      </div>

      <NInputGroup>
        <NInput
          :value="previewUrl"
          readonly
          size="small"
        />
        <NButton
          type="primary"
          secondary
          size="small"
          :disabled="!previewUrl"
          @click="copyToClipboard(previewUrl)"
        >
          复制
        </NButton>
      </NInputGroup>

      <NCollapse accordion>
        <NCollapseItem title="使用说明">
          <NUl>
            <NLi>在 OBS 来源中添加一个新的「浏览器」源。</NLi>
            <NLi>将上方 URL 粘贴到「URL」栏中。</NLi>
            <NLi>推荐宽度 280px 左右，高度 500px 以上，可按直播布局调整。</NLi>
            <NLi>可通过 `style` 参数切换 `classic`、`fresh`、`minimal` 三种风格。</NLi>
            <NLi>可通过 `speed` 参数调节列表滚动速度。</NLi>
          </NUl>
        </NCollapseItem>
      </NCollapse>
    </NFlex>
  </NModal>
</template>

<style scoped>
.queue-obs-modal__preview {
  height: 500px;
  width: 280px;
  position: relative;
  margin: 0 auto;
  border: 1px dashed var(--n-border-color);
  overflow: hidden;
}

.queue-obs-modal__empty {
  padding-top: 100px;
}

.queue-obs-modal__speed-group {
  width: 220px;
}
</style>
