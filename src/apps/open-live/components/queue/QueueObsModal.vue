<script setup lang="ts">
import { NAlert, NButton, NCollapse, NCollapseItem, NDivider, NEmpty, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NLi, NModal, NFlex, NUl } from 'naive-ui';
import { computed } from 'vue'
import QueueOBS from '@/apps/obs/pages/QueueOBS.vue'
import { CURRENT_HOST } from '@/shared/config'
import { copyToClipboard } from '@/shared/utils'

const props = defineProps<{
  show: boolean
  userId?: number
  speed: number
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:speed', value: number): void
}>()

const showModel = computed({
  get: () => props.show,
  set: value => emit('update:show', value),
})

const speedModel = computed({
  get: () => props.speed,
  set: value => emit('update:speed', value),
})

const baseUrl = computed(() => {
  if (!props.userId) return ''
  return `${CURRENT_HOST}obs/queue?id=${props.userId}`
})
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    style="width: 900px; max-width: 90vw"
    title="OBS 浏览器源组件"
    closable
  >
    <NFlex vertical :size="12">
      <NAlert title="使用方法" type="info" size="small" :bordered="false">
        将下方链接添加为 OBS（或其他直播软件）的浏览器源，即可在直播画面中显示队列。
      </NAlert>

      <NFlex vertical :size="10">
        <NInputGroup>
          <NInputGroupLabel>URL</NInputGroupLabel>
          <NInput :value="baseUrl" readonly size="small" />
          <NButton type="primary" secondary size="small" :disabled="!baseUrl" @click="copyToClipboard(baseUrl)">
            复制
          </NButton>
        </NInputGroup>

        <NInputGroup>
          <NInputGroupLabel>滚动速度</NInputGroupLabel>
          <NInputNumber
            v-model:value="speedModel"
            :min="0.5"
            :max="5"
            :step="0.1"
            placeholder="默认 1.0"
            size="small"
            class="queue-obs-modal__speed"
          />
          <NButton
            type="primary"
            secondary
            size="small"
            :disabled="!baseUrl"
            @click="copyToClipboard(`${baseUrl}&speed=${speedModel}`)"
          >
            复制带速度 URL
          </NButton>
        </NInputGroup>
      </NFlex>

      <NDivider style="margin: 0">
        预览（尺寸可能与实际不同）
      </NDivider>
      <div class="queue-obs-modal__preview">
        <QueueOBS
          v-if="userId"
          :id="userId"
          :speed-multiplier="speedModel"
        />
        <NEmpty
          v-else
          description="无法预览：未获取到用户信息"
          size="small"
          class="queue-obs-modal__empty"
        />
      </div>

      <NCollapse accordion>
        <NCollapseItem title="详细说明">
          <NUl>
            <NLi>在 OBS 中添加一个新的「浏览器」来源。</NLi>
            <NLi>将上方 URL 粘贴到「URL」栏中。</NLi>
            <NLi>推荐宽度设置为 280–350px，高度根据需要调整（例如 500–700px）。</NLi>
            <NLi>可在「设置」标签页中调整 OBS 组件的显示内容。</NLi>
            <NLi>如需自定义样式，可在 OBS 的「自定义 CSS」中添加覆盖样式。</NLi>
          </NUl>
        </NCollapseItem>
      </NCollapse>
    </NFlex>
  </NModal>
</template>

<style scoped>
.queue-obs-modal__preview {
  height: 450px;
  width: 280px;
  position: relative;
  margin: 0 auto;
  border: 1px dashed var(--n-border-color);
  overflow: hidden;
}

.queue-obs-modal__empty {
  padding-top: 100px;
}

.queue-obs-modal__speed {
  width: 140px;
}
</style>
