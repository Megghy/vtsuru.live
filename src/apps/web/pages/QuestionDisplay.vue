<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { useDebounceFn, useElementSize } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import { SaveSetting, useAccount } from '@/api/account'
import type { Setting_QuestionDisplay } from '@/api/api-models'
import { QuestionDisplayAlign } from '@/api/api-models'
import QuestionItem from '@/components/QuestionItem.vue'
import QuestionItems from '@/components/QuestionItems.vue'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { CURRENT_HOST } from '@/shared/config'
import { showErrorToast, showSuccessToast } from '@/shared/services/toast'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useQuestionBox } from '@/store/useQuestionBox'
import { useWebRTC } from '@/store/useRTC'

const accountInfo = useAccount()
const defaultSettings = {} as Setting_QuestionDisplay
const useQB = useQuestionBox()
const rtc = await useWebRTC().Init('master')

const showSettingDrawer = ref(false)
const showGreenBorder = ref(false)
const showOBSModal = ref(false)

const isLoading = ref(false)

const cardRef = ref<HTMLElement>()
const cardSize = useElementSize(cardRef)
const savedCardSize = usePersistedStorage<{ width: number; height: number }>('Settings.QuestionDisplay.CardSize', {
  width: 400,
  height: 400,
})
const customCss = usePersistedStorage<string>('Settings.QuestionDisplay.CustomCss', '')

const debouncedSize = useDebounceFn(() => {
  savedCardSize.value = { width: cardSize.width.value, height: cardSize.height.value }
}, 500)
watch([cardSize.width, cardSize.height], () => {
  if (cardSize.width.value > 300 && cardSize.height.value > 300) {
    debouncedSize()
  }
})
const scrollInfo = ref<{ clientHeight: number; scrollHeight: number; scrollTop: number }>()
const debouncedScroll = useDebounceFn(() => {
  rtc?.send('function.question.sync-scroll', scrollInfo.value)
}, 200)

const setting = computed({
  get: () => {
    if (accountInfo.value && accountInfo.value.settings) {
      return accountInfo.value.settings.questionDisplay
    }
    return defaultSettings
  },
  set: (value) => {
    if (accountInfo.value) {
      accountInfo.value.settings.questionDisplay = value
    }
  },
})
const alignModel = computed({
  get: () => String(setting.value.align),
  set: (value: string) => {
    setting.value.align = Number(value) as QuestionDisplayAlign
  },
})
const alignmentOptions = [
  { label: '左对齐', value: String(QuestionDisplayAlign.Left) },
  { label: '居中', value: String(QuestionDisplayAlign.Center) },
  { label: '右对齐', value: String(QuestionDisplayAlign.Right) },
]
async function updateSettings() {
  if (!accountInfo.value) return showSuccessToast('完成')
  isLoading.value = true
  try {
    const result = await SaveSetting('QuestionDisplay', setting.value)
    if (!result) throw new Error('服务端未确认保存')
    showSuccessToast('已保存')
  } catch (error) {
    showErrorToast(`保存失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isLoading.value = false
  }
}
const fontsOptions = usePersistedStorage<{ label: string; value: string }[]>('Settings.Fonts', [])
async function loadFonts() {
  if ('queryLocalFonts' in window) {
    // @ts-expect-error 不知道为啥不存在
    const status = await navigator.permissions.query({ name: 'local-fonts' })
    if (status.state === 'granted') {
      console.log('Permission was granted 👍')
    } else if (status.state === 'prompt') {
      console.log('Permission will be requested')
    } else {
      console.log('Permission was denied 👎')
      showErrorToast('你没有授予本地字体权限，无法读取本地字体')
    }
    // @ts-expect-error 不知道为啥不存在
    const fonts = await window.queryLocalFonts()
    fontsOptions.value = fonts.map((f: any) => {
      return { label: f.fullName, value: f.fullName }
    })
    showSuccessToast(`已获取字体列表，共 ${fontsOptions.value.length} 个字体`)
  } else {
    showErrorToast('你的浏览器不支持获取字体列表')
  }
}
function colorValue(value?: string) {
  return `#${value || '000000'}`
}
function setColor(field: 'fontColor' | 'backgroundColor' | 'borderColor' | 'nameFontColor', value: string) {
  setting.value[field] = value.slice(1)
}
function syncScroll(value: { clientHeight: number; scrollHeight: number; scrollTop: number }) {
  if (!setting.value.syncScroll) {
    return
  }
  scrollInfo.value = value
  debouncedScroll()
}

onMounted(() => {
  useQB.GetRecieveQAInfo()

  useQB.displayQuestion = useQB.recieveQuestions.find(
    (s) => s.id == accountInfo.value?.settings.questionDisplay.currentQuestion,
  )
})
</script>

<template>
  <main class="question-studio">
    <aside class="question-panel">
      <section class="studio-card content-toolbar">
        <div class="section-heading">
          <div>
            <p>QUESTION DISPLAY</p>
            <h1>内容设置</h1>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            @click="$router.push({ name: 'manage-questionBox' })"
          >
            回到控制台
          </UButton>
        </div>
        <div class="filter-row">
          <USelect
            v-model="useQB.displayTag"
            placeholder="选择当前话题"
            :items="useQB.tags.map((tag) => ({ label: tag.name, value: tag.name }))"
            class="tag-select"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            @click="useQB.GetRecieveQAInfo"
          >
            刷新
          </UButton>
          <UCheckbox
            v-model="useQB.onlyFavorite"
            label="只显示收藏"
          />
          <UCheckbox
            v-model="useQB.onlyUnread"
            label="只显示未读"
          />
        </div>
      </section>
      <template v-if="useQB.displayQuestion">
        <USeparator />
        <section class="studio-card current-question">
          <div class="section-heading">
            <h2>当前展示</h2>
            <div class="question-actions">
              <UButton
                color="neutral"
                variant="soft"
                @click="useQB.setCurrentQuestion(useQB.displayQuestion)"
              >
                取消展示
              </UButton>
              <UButton
                color="success"
                variant="soft"
                @click="useQB.read(useQB.displayQuestion, true)"
              >
                已读
              </UButton>
            </div>
          </div>
          <QuestionItem
            :item="useQB.displayQuestion"
            class="current-question-content"
          />
        </section>
        <USeparator />
      </template>

      <div class="question-list-scroll">
        <QuestionItems :questions="useQB.recieveQuestionsFiltered">
          <template #footer="{ item }">
            <div class="question-actions">
              <UTooltip :text="`${item.id === useQB.displayQuestion?.id ? '取消' : ''}设为当前展示的提问`">
                <UButton
                  :color="item.id !== useQB.displayQuestion?.id ? 'neutral' : 'primary'"
                  :variant="item.id !== useQB.displayQuestion?.id ? 'soft' : 'solid'"
                  :icon="
                    item.id !== useQB.displayQuestion?.id ? 'i-lucide-arrow-right-circle' : 'i-lucide-arrow-left-circle'
                  "
                  @click="useQB.setCurrentQuestion(item)"
                />
              </UTooltip>
              <UButton
                v-if="!item.isReaded"
                color="success"
                variant="soft"
                @click="useQB.read(item, true)"
              >
                设为已读
              </UButton>
              <UButton
                v-else
                color="warning"
                variant="soft"
                @click="useQB.read(item, false)"
              >
                重设为未读
              </UButton>
              <UButton
                :color="item.isFavorite ? 'error' : 'neutral'"
                variant="soft"
                :icon="item.isFavorite ? 'i-lucide-heart' : 'i-lucide-heart-plus'"
                @click="useQB.favorite(item, !item.isFavorite)"
              >
                收藏
              </UButton>
            </div>
          </template>
        </QuestionItems>
      </div>
    </aside>
    <section class="studio-card preview-panel">
      <div class="preview-toolbar">
        <UButton
          icon="i-lucide-settings-2"
          @click="showSettingDrawer = true"
        >
          打开设置
        </UButton>
        <UButton
          variant="soft"
          icon="i-lucide-monitor-up"
          @click="showOBSModal = true"
        >
          预览OBS组件
        </UButton>
        <UTooltip text="用于使用 OBS 直接捕获浏览器窗口时消除背景">
          <UCheckbox
            v-model="showGreenBorder"
            label="显示边框"
          />
        </UTooltip>

        <UTooltip text="实验性功能：当前页面滚动会同步到 OBS 组件">
          <UCheckbox
            v-model="setting.syncScroll"
            label="同步滚动"
            @update:model-value="updateSettings"
          />
        </UTooltip>
        <template v-if="useQB.displayQuestion">
          <USeparator orientation="vertical" />
          <UButton
            color="success"
            @click="useQB.read(useQB.displayQuestion, true)"
          >
            将当前问题设为已读
          </UButton>
        </template>
      </div>
      <USeparator :label="`${cardSize.width.value.toFixed(0)} × ${cardSize.height.value.toFixed(0)}`" />
      <div class="preview-stage">
        <div
          ref="cardRef"
          class="resize-box"
          :style="{
            border: showGreenBorder ? '24px solid green' : '',
            background: showGreenBorder ? 'green' : '',
            padding: '10px',
            width: `${savedCardSize.width}px`,
            height: `${savedCardSize.height}px`,
          }"
        >
          <QuestionDisplayCard
            :question="useQB.displayQuestion"
            :setting="setting"
            :css="customCss"
            @scroll="syncScroll"
          />
        </div>
      </div>
    </section>
  </main>
  <USlideover
    v-model:open="showSettingDrawer"
    title="设置"
    side="left"
  >
    <template #body>
      <form
        class="display-settings"
        @submit.prevent="updateSettings"
      >
        <UFormField label="文字对齐">
          <URadioGroup
            v-model="alignModel"
            :items="alignmentOptions"
            orientation="horizontal"
            variant="card"
          />
        </UFormField>
        <div class="toggle-row">
          <UCheckbox
            v-model="setting.showImage"
            label="显示图片"
          />
          <UCheckbox
            v-model="setting.showUserName"
            label="显示投稿用户名"
          />
        </div>

        <USeparator label="内容样式" />
        <div class="settings-grid">
          <UFormField label="字体大小">
            <UInputNumber
              v-model="setting.fontSize"
              :min="1"
              :max="1000"
            />
          </UFormField>
          <UFormField label="边框宽度">
            <UInputNumber
              v-model="setting.borderWidth"
              :min="0"
              :max="1000"
            />
          </UFormField>
          <UFormField label="字重">
            <UInputNumber
              v-model="setting.fontWeight"
              :min="1"
              :max="10000"
              :step="100"
            />
          </UFormField>
        </div>
        <UFieldGroup>
          <USelect
            v-model="setting.font"
            :items="fontsOptions"
            placeholder="选择内容字体"
            class="font-select"
          />
          <UButton
            color="neutral"
            variant="soft"
            @click="loadFonts"
          >
            获取字体列表
          </UButton>
        </UFieldGroup>
        <div class="color-grid">
          <UFormField label="字体颜色">
            <UColorPicker
              :model-value="colorValue(setting.fontColor)"
              @update:model-value="setColor('fontColor', $event)"
            />
          </UFormField>
          <UFormField label="背景颜色">
            <UColorPicker
              :model-value="colorValue(setting.backgroundColor)"
              @update:model-value="setColor('backgroundColor', $event)"
            />
          </UFormField>
          <UFormField label="边框颜色">
            <UColorPicker
              :model-value="colorValue(setting.borderColor)"
              @update:model-value="setColor('borderColor', $event)"
            />
          </UFormField>
        </div>

        <USeparator label="用户名样式" />
        <div class="settings-grid">
          <UFormField label="字体大小">
            <UInputNumber
              v-model="setting.nameFontSize"
              :min="1"
              :max="1000"
            />
          </UFormField>
          <UFormField label="字重">
            <UInputNumber
              v-model="setting.nameFontWeight"
              :min="1"
              :max="10000"
              :step="100"
            />
          </UFormField>
          <UFormField label="字体颜色">
            <UColorPicker
              :model-value="colorValue(setting.nameFontColor)"
              @update:model-value="setColor('nameFontColor', $event)"
            />
          </UFormField>
        </div>
        <USelect
          v-model="setting.nameFont"
          :items="fontsOptions"
          placeholder="选择用户名字体"
        />

        <USeparator label="自定义样式（CSS）" />
        <UTextarea
          v-model="customCss"
          :rows="8"
          placeholder="输入仅在当前页面生效的 CSS"
        />
        <UButton
          type="submit"
          block
          :loading="isLoading"
        >
          保存设置
        </UButton>
      </form>
    </template>
  </USlideover>
  <UModal
    v-model:open="showOBSModal"
    title="OBS 组件"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="obs-preview">
        <div
          :style="{
            width: `${savedCardSize.width}px`,
            height: `${savedCardSize.height}px`,
          }"
        >
          <QuestionDisplayCard
            :question="useQB.displayQuestion"
            :setting="setting"
          />
        </div>
        <USeparator />
        <UInput
          readonly
          :model-value="`${CURRENT_HOST}obs/question-display?token=${accountInfo?.token}`"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.question-studio {
  display: grid;
  grid-template-columns: minmax(360px, 0.85fr) minmax(480px, 1.15fr);
  gap: 16px;
  min-height: calc(100vh - 40px);
  margin: 20px;
}

.question-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.studio-card {
  padding: 16px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}

.section-heading,
.filter-row,
.question-actions,
.preview-toolbar,
.toggle-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.section-heading {
  justify-content: space-between;
}

.section-heading p,
.section-heading h1,
.section-heading h2 {
  margin: 0;
}

.section-heading p {
  color: var(--vtsuru-brand);
  font-size: 11px;
  font-weight: 700;
}

.filter-row {
  margin-top: 14px;
}

.tag-select {
  min-width: 180px;
}

.current-question-content {
  max-height: 200px;
  overflow-y: auto;
}

.question-list-scroll {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.preview-panel {
  display: flex;
  flex-direction: column;
  min-height: 600px;
}

.preview-stage {
  display: grid;
  flex: 1;
  overflow: auto;
  place-items: center;
}

.display-settings,
.obs-preview {
  display: grid;
  gap: 16px;
}

.settings-grid,
.color-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.font-select {
  flex: 1;
}

.obs-preview {
  justify-items: center;
  overflow: auto;
}

.resize-box {
  display: flex;
  justify-content: center;
  overflow-y: visible;
  min-width: 300px;
  min-height: 100px;
  resize: both;
  overflow: auto;
  overflow-y: hidden;
  padding: 10px;
}

@media (max-width: 900px) {
  .question-studio {
    grid-template-columns: minmax(0, 1fr);
  }

  .question-panel {
    max-height: 80vh;
  }
}

@media (max-width: 520px) {
  .question-studio {
    margin: 10px;
  }

  .settings-grid,
  .color-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
