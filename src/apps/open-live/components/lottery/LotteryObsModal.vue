<script setup lang="ts">
import { Copy24Regular, Open24Regular } from '@vicons/fluent'
import { NAlert, NButton, NCollapse, NCollapseItem, NIcon, NInput, NInputGroup, NLi, NModal, NUl } from 'naive-ui'
import { computed, ref } from 'vue'

import LiveLotteryOBS from '@/apps/obs/pages/LiveLotteryOBS.vue'
import {
  buildLotteryObsUrl,
  type LotteryObsMode,
  type LotteryObsStyle,
} from '@/apps/open-live/components/lottery/lotteryUtils'
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

const selectedMode = ref<LotteryObsMode>('card')
const selectedStyle = ref<LotteryObsStyle>('slate')

const modeOptions: Array<{ value: LotteryObsMode; label: string; desc: string }> = [
  { value: 'card', label: '标准卡片', desc: '侧边栏' },
  { value: 'banner', label: '横向长条', desc: '顶底栏' },
  { value: 'compact', label: '悬浮胶囊', desc: '小挂件' },
  { value: 'grid', label: '舞台网格', desc: '多列墙' },
]

const styleOptions: Array<{ value: LotteryObsStyle; label: string; desc: string }> = [
  { value: 'slate', label: '现代深邃', desc: '推荐' },
  { value: 'transparent', label: '纯粹悬浮', desc: '无底框' },
  { value: 'champagne', label: '温润香槟', desc: '微金光' },
  { value: 'classic', label: '经典暗色', desc: '兼容' },
]

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const url = computed(() =>
  buildLotteryObsUrl(CURRENT_HOST, props.userId, props.code, selectedStyle.value, selectedMode.value),
)

const recommendedSize = computed(() => {
  switch (selectedMode.value) {
    case 'banner':
      return { width: '680px', height: '54px', text: '宽 680px，高 54px（适合贴在画面顶部或底部）' }
    case 'compact':
      return { width: '220px', height: '64px', text: '宽 220px，高 64px（适合贴在角落作为微型小挂件）' }
    case 'grid':
      return { width: '380px', height: '280px', text: '宽 380px，高 280px（适合切屏到大舞台头像墙）' }
    case 'card':
    default:
      return { width: '260px', height: '420px', text: '宽 260px，高 420px（适合贴在左/右侧边栏）' }
  }
})

const previewBoxStyle = computed(() => {
  switch (selectedMode.value) {
    case 'banner':
      return { width: '100%', maxWidth: '380px', height: '54px' }
    case 'compact':
      return { width: '220px', height: '64px' }
    case 'grid':
      return { width: '100%', maxWidth: '340px', height: '260px' }
    case 'card':
    default:
      return { width: '260px', height: '380px' }
  }
})
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    class="lottery-obs-modal"
    title="OBS 抽奖组件"
    style="width: 860px; max-width: 95vw; max-height: 90vh"
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
      <!-- 左侧：链接与配置 -->
      <div class="lottery-obs-modal__main">
        <NAlert
          type="info"
          size="small"
          :bordered="false"
        >
          将抽奖等待队列与中奖揭榜结果实时展示在 OBS 浏览器源中。
        </NAlert>

        <!-- 显示版型 -->
        <div class="lottery-obs-modal__section">
          <div class="lottery-obs-modal__section-title">显示版型</div>
          <div class="lottery-segmented-grid">
            <button
              v-for="opt in modeOptions"
              :key="opt.value"
              type="button"
              class="lottery-segmented-btn"
              :class="{ 'is-active': selectedMode === opt.value }"
              @click="selectedMode = opt.value"
            >
              <span class="btn-label">{{ opt.label }}</span>
              <span class="btn-desc">{{ opt.desc }}</span>
            </button>
          </div>
        </div>

        <!-- 视觉风格 -->
        <div class="lottery-obs-modal__section">
          <div class="lottery-obs-modal__section-title">视觉风格</div>
          <div class="lottery-segmented-grid">
            <button
              v-for="opt in styleOptions"
              :key="opt.value"
              type="button"
              class="lottery-segmented-btn"
              :class="{ 'is-active': selectedStyle === opt.value }"
              @click="selectedStyle = opt.value"
            >
              <span class="btn-label">{{ opt.label }}</span>
              <span class="btn-desc">{{ opt.desc }}</span>
            </button>
          </div>
        </div>

        <!-- 链接复制 -->
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
              <NLi>当前推荐尺寸：{{ recommendedSize.text }}。</NLi>
              <NLi>选择版型与风格后链接自动更新，直接点击「复制」即可。</NLi>
            </NUl>
          </NCollapseItem>
        </NCollapse>
      </div>

      <!-- 右侧：实时预览 -->
      <div class="lottery-obs-modal__side">
        <div class="lottery-obs-modal__preview-label">
          实时预览 ({{ recommendedSize.width }} × {{ recommendedSize.height }})
        </div>
        <div class="lottery-obs-modal__preview-stage">
          <div
            class="lottery-obs-modal__preview-wrapper"
            :style="previewBoxStyle"
          >
            <LiveLotteryOBS
              :code="code"
              :id="userId"
              :style="selectedStyle"
              :mode="selectedMode"
            />
          </div>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.lottery-obs-modal__body {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) 300px;
  gap: 24px;
  align-items: start;
}

@media (max-width: 720px) {
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

/* 2x2 规整分段卡片网格 */
.lottery-segmented-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  width: 100%;
}

.lottery-segmented-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg);
  color: var(--vtsuru-fg);
  cursor: pointer;
  outline: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.lottery-segmented-btn:hover {
  background: var(--vtsuru-bg-elevated);
  border-color: var(--vtsuru-brand-tint, rgba(56, 189, 248, 0.4));
}

.lottery-segmented-btn.is-active {
  background: var(--vtsuru-brand-soft, rgba(56, 189, 248, 0.12));
  border-color: var(--vtsuru-brand, #38bdf8);
  color: var(--vtsuru-brand, #38bdf8);
  font-weight: 600;
}

.btn-label {
  font-size: 12px;
}

.btn-desc {
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  padding: 1px 5px;
  border-radius: 4px;
}

.lottery-segmented-btn.is-active .btn-desc {
  color: var(--vtsuru-brand, #38bdf8);
  background: rgba(56, 189, 248, 0.18);
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
  text-align: center;
}

.lottery-obs-modal__preview-stage {
  width: 100%;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--vtsuru-border);
  border-radius: 8px;
  background: var(--vtsuru-bg-muted);
  padding: 12px;
  box-sizing: border-box;
}

.lottery-obs-modal__preview-wrapper {
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.lottery-obs-modal__help {
  margin-top: 4px;
}
</style>
