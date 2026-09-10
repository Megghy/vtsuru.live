<script setup lang="ts">
import { Copy24Regular, Open24Regular } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCollapse,
  NCollapseItem,
  NIcon,
  NInput,
  NInputGroup,
  NLi,
  NModal,
  NUl,
} from 'naive-ui'
import { computed } from 'vue'

import LiveLotteryOBS from '@/apps/obs/pages/LiveLotteryOBS.vue'
import { buildLotteryObsUrl } from '@/apps/open-live/components/lottery/lotteryUtils'
import { CURRENT_HOST } from '@/shared/config'
import { copyToClipboard } from '@/shared/utils'

const props = defineProps<{
  show: boolean
  code?: string
  userId?: number | string | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const url = computed(() => buildLotteryObsUrl(CURRENT_HOST, props.userId, props.code))
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    class="lottery-obs-modal"
    title="OBS 组件"
    style="width: 820px; max-width: 95vw; max-height: 90vh"
    closable
    content-style="overflow-y: auto; max-height: calc(90vh - 110px); padding: 16px 20px;"
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
        <template #icon>
          <NIcon :component="Open24Regular" />
        </template>
        浏览
      </NButton>
    </template>

    <div class="lottery-obs-modal__body">
      <!-- 左侧：链接与说明 -->
      <div class="lottery-obs-modal__main">
        <NAlert
          type="info"
          size="small"
          :bordered="false"
        >
          将抽奖等待队列与结果显示在 OBS 的浏览器源中。
        </NAlert>

        <div class="lottery-obs-modal__section">
          <div class="lottery-obs-modal__section-title">OBS 浏览器源链接</div>
          <NAlert
            v-if="!url"
            type="warning"
            size="small"
            :bordered="false"
          >
            未获取到用户信息，无法生成 OBS 链接。请先登录，或通过幻星平台打开本页。
          </NAlert>
          <NInputGroup v-else>
            <NInput
              :value="url"
              readonly
            />
            <NButton
              type="primary"
              @click="copyToClipboard(url)"
            >
              <template #icon>
                <NIcon :component="Copy24Regular" />
              </template>
              复制
            </NButton>
          </NInputGroup>
        </div>

        <NCollapse class="lottery-obs-modal__help">
          <NCollapseItem title="OBS 使用说明">
            <NUl style="padding-left: 18px; margin: 4px 0">
              <NLi>在 OBS 来源中添加一个新的「浏览器」源。</NLi>
              <NLi>将上方链接复制并粘贴到「URL」栏中。</NLi>
              <NLi>推荐初始尺寸：宽 250px，高 400px（可按实际直播布局自由缩放）。</NLi>
              <NLi>在右侧可实时预览组件视觉效果。</NLi>
            </NUl>
          </NCollapseItem>
        </NCollapse>
      </div>

      <!-- 右侧：实时预览 -->
      <div class="lottery-obs-modal__side">
        <div class="lottery-obs-modal__preview-label">实时预览 (250 × 400)</div>
        <div class="lottery-obs-modal__preview">
          <LiveLotteryOBS
            :code="code"
            :id="userId"
          />
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.lottery-obs-modal__body {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) 250px;
  gap: 24px;
  align-items: start;
}

@media (max-width: 680px) {
  .lottery-obs-modal__body {
    grid-template-columns: 1fr;
  }
}

.lottery-obs-modal__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.lottery-obs-modal__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lottery-obs-modal__section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--vtsuru-fg);
}

.lottery-obs-modal__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.lottery-obs-modal__preview-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.lottery-obs-modal__preview {
  height: 400px;
  width: 250px;
  position: relative;
  border: 1px dashed var(--vtsuru-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vtsuru-bg-muted);
}

.lottery-obs-modal__help {
  margin-top: 4px;
}
</style>
