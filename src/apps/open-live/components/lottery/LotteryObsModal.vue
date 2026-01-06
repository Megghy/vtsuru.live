<script setup lang="ts">
import { NAlert, NCollapse, NCollapseItem, NDivider, NInput, NLi, NModal, NUl } from 'naive-ui'
import { computed } from 'vue'
import LiveLotteryOBS from '@/apps/obs/pages/LiveLotteryOBS.vue'
import { CURRENT_HOST } from '@/shared/config'

const props = defineProps<{
  show: boolean
  code?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const showModel = computed({
  get: () => props.show,
  set: value => emit('update:show', value),
})

const url = computed(() => {
  if (!props.code) return ''
  return `${CURRENT_HOST}obs/live-lottery?code=${props.code}`
})
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    title="OBS 组件"
    style="max-width: 90%; width: 800px; max-height: 90vh"
    closable
    content-style="overflow: auto"
  >
    <NAlert title="这是什么?  " type="info">
      将等待队列以及结果显示在OBS中
    </NAlert>
    <NDivider> 浏览 </NDivider>
    <div style="height: 400px; width: 250px; position: relative; margin: 0 auto">
      <LiveLotteryOBS :code="code" />
    </div>
    <br>
    <NInput :value="url" />
    <NDivider />
    <NCollapse>
      <NCollapseItem title="使用说明">
        <NUl>
          <NLi>在 OBS 来源中添加源, 选择 浏览器</NLi>
          <NLi>在 URL 栏填入上方链接</NLi>
          <NLi>根据自己的需要调整宽度和高度 (这里是宽 250px 高 400px)</NLi>
          <NLi>完事</NLi>
        </NUl>
      </NCollapseItem>
    </NCollapse>
    <NDivider />
  </NModal>
</template>

