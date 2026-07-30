<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCollapse,
  NCollapseItem,
  NDivider,
  NFlex,
  NInput,
  NInputGroup,
  NLi,
  NModal,
  NUl,
} from 'naive-ui'
import { computed } from 'vue'

import LiveLotteryOBS from '@/apps/obs/pages/LiveLotteryOBS.vue'
import { CURRENT_HOST } from '@/shared/config'
import { copyToClipboard } from '@/shared/utils'

const props = defineProps<{
  show: boolean
  code?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const url = computed(() => {
  if (!props.code) return ''
  const params = new URLSearchParams({ code: props.code })
  return `${CURRENT_HOST}obs/live-lottery?${params.toString()}`
})
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    title="OBS 组件"
    style="width: 900px; max-width: 90vw; max-height: 90vh"
    closable
    content-style="overflow: auto"
  >
    <template #header-extra>
      <NButton
        v-if="url"
        tag="a"
        type="primary"
        size="small"
        target="_blank"
        :href="url"
      >
        浏览
      </NButton>
    </template>
    <NFlex
      vertical
      :size="12"
    >
      <NAlert
        title="这是什么？"
        type="info"
        size="small"
        :bordered="false"
      >
        将抽奖等待队列与结果显示在 OBS 的浏览器源中。
      </NAlert>

      <NDivider style="margin: 0"> 预览 </NDivider>
      <div class="lottery-obs-modal__preview">
        <LiveLotteryOBS :code="code" />
      </div>

      <NInputGroup>
        <NInput
          :value="url"
          size="small"
          readonly
        />
        <NButton
          type="primary"
          secondary
          size="small"
          :disabled="!url"
          @click="copyToClipboard(url)"
        >
          复制
        </NButton>
      </NInputGroup>

      <NCollapse>
        <NCollapseItem title="使用说明">
          <NUl>
            <NLi>在 OBS 来源中添加源，选择「浏览器」。</NLi>
            <NLi>在 URL 栏填入上方链接。</NLi>
            <NLi>根据自己的需要调整宽度和高度（这里是宽 250px 高 400px）。</NLi>
            <NLi>完成。</NLi>
          </NUl>
        </NCollapseItem>
      </NCollapse>
    </NFlex>
  </NModal>
</template>

<style scoped>
.lottery-obs-modal__preview {
  height: 400px;
  width: 250px;
  position: relative;
  margin: 0 auto;
}
</style>
