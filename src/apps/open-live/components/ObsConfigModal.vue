<script setup lang="ts">
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
    content: '将等待队列以及结果显示在 OBS 中。',
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

const obsUrl = computed(() => {
  const params = new URLSearchParams({ id: String(props.userId ?? 0) })
  if (props.showStyleOptions) {
    params.set('style', styleModel.value)
    params.set('speed', String(speedModel.value))
  }
  if (accountInfo.value?.token) {
    params.set('token', accountInfo.value.token)
  }
  return `${CURRENT_HOST}${props.obsPath}?${params.toString()}`
})
</script>

<template>
  <UModal
    v-model:open="showModel"
    preset="card"
    style="width: 900px; max-width: 90vw"
    title="OBS组件"
    closable
  >
    <template #header-extra>
      <UButton
        tag="a"
        color="primary"
        size="small"
        target="_blank"
        :href="obsUrl"
      >
        浏览
      </UButton>
    </template>
    <div
      vertical
      :size="12"
    >
      <UAlert
        title="这是什么？"
        type="info"
        size="small"
        :bordered="false"
      >
        {{ description }}
      </UAlert>

      <template v-if="showStyleOptions">
        <USeparator style="margin: 0"> 样式与速度 </USeparator>
        <div
          align="center"
          :wrap="true"
          :size="12"
        >
          <URadioGroup
            v-model="styleModel"
            name="obsStyle"
            :items="[
              { label: '经典黑色风格', value: 'classic' },
              { label: '清新明亮风格', value: 'fresh' },
              { label: '极简无背景', value: 'minimal' },
            ]"
            orientation="horizontal"
          />
          <div class="obs-config-modal__speed-group">
            <span>滚动速度倍率</span>
            <UInputNumber
              v-model="speedModel"
              :min="0.5"
              :max="5"
              :step="0.1"
              placeholder="1"
            />
          </div>
          <UTooltip>
            <UIcon name="i-lucide-circle" />
            <template #content> 数值越大滚动越快（0.5 ~ 5） </template>
          </UTooltip>
        </div>
      </template>

      <USeparator style="margin: 0"> 预览 </USeparator>
      <div class="obs-config-modal__preview">
        <slot
          v-if="userId"
          name="preview"
          :style-type="styleModel"
          :speed="speedModel"
        />
        <UEmpty
          v-else
          description="无法预览：未获取到用户信息"
          size="small"
          class="obs-config-modal__empty"
        />
      </div>

      <div>
        <UInput
          :value="obsUrl"
          readonly
          size="small"
        />
        <UButton
          color="primary"
          variant="soft"
          size="small"
          :disabled="!obsUrl"
          @click="copyToClipboard(obsUrl)"
        >
          复制
        </UButton>
      </div>

      <div accordion>
        <details title="使用说明">
          <ul>
            <li>在 OBS 来源中添加一个新的「浏览器」源。</li>
            <li>将上方 URL 粘贴到「URL」栏中。</li>
            <li>推荐宽度 280px 左右，高度 500px 以上，可按直播布局调整。</li>
            <template v-if="showStyleOptions">
              <li>可通过 `style` 参数切换 `classic`、`fresh`、`minimal` 三种风格。</li>
              <li>可通过 `speed` 参数调节列表滚动速度。</li>
            </template>
          </ul>
        </details>
      </div>
    </div>
  </UModal>
</template>

<style scoped>
.obs-config-modal__preview {
  height: 500px;
  width: 280px;
  position: relative;
  margin: 0 auto;
  border: 1px dashed var(--vtsuru-border);
  overflow: hidden;
}

.obs-config-modal__empty {
  padding-top: 100px;
}

.obs-config-modal__speed-group {
  width: 220px;
}
</style>
