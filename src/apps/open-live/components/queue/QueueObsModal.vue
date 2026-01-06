<script setup lang="ts">
import { NAlert, NButton, NCollapse, NCollapseItem, NDivider, NEmpty, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NLi, NModal, NUl } from 'naive-ui'
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
    style="width: 90%; max-width: 600px;"
    title="OBS 浏览器源组件"
    closable
  >
    <NAlert
      title="使用方法"
      type="info"
      style="margin-bottom: 15px;"
    >
      将下方链接添加为 OBS 或其他直播软件的浏览器源，即可在直播画面中显示队列。
    </NAlert>
    <NInputGroup style="margin-bottom: 15px;">
      <NInputGroupLabel> URL </NInputGroupLabel>
      <NInput :value="baseUrl" readonly />
      <NButton type="primary" ghost :disabled="!baseUrl" @click="copyToClipboard(baseUrl)">
        复制
      </NButton>
    </NInputGroup>
    <NInputGroup style="margin-bottom: 15px;">
      <NInputGroupLabel>滚动速度</NInputGroupLabel>
      <NInputNumber
        v-model:value="speedModel"
        :min="0.5"
        :max="5"
        :step="0.1"
        placeholder="默认1.0"
      />
      <NButton
        type="primary"
        ghost
        :disabled="!baseUrl"
        @click="copyToClipboard(`${baseUrl}&speed=${speedModel}`)"
      >
        复制带速度URL
      </NButton>
    </NInputGroup>
    <NDivider> 预览 (尺寸可能与实际不同) </NDivider>
    <div
      style="height: 450px; width: 280px; position: relative; margin: 0 auto; border: 1px dashed #ccc; overflow: hidden;"
    >
      <QueueOBS
        v-if="userId"
        :id="userId"
        :speed-multiplier="speedModel"
      />
      <NEmpty
        v-else
        description="无法预览，未获取到用户信息"
        style="padding-top: 100px;"
      />
    </div>
    <NCollapse style="margin-top: 15px;" accordion>
      <NCollapseItem title="详细说明">
        <NUl>
          <NLi>在 OBS 中添加一个新的"浏览器"来源。</NLi>
          <NLi>将上方 URL 粘贴到"URL"栏中。</NLi>
          <NLi>推荐宽度设置为 280-350px，高度根据需要调整 (例如 500-700px)。</NLi>
          <NLi>可在"设置"标签页中调整 OBS 组件的显示内容。</NLi>
          <NLi>如果需要自定义样式，可以在 OBS 的"自定义 CSS"中添加覆盖样式。</NLi>
        </NUl>
      </NCollapseItem>
    </NCollapse>
  </NModal>
</template>

