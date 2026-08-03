<script setup lang="ts">
import { computed } from 'vue'

import type { UserPageAppearanceTheme } from '@/apps/user-page/themeConfig'

import PropsGrid from './PropsGrid.vue'

export interface ThemeAppearanceTarget {
  get: () => UserPageAppearanceTheme | undefined
  ensure: () => UserPageAppearanceTheme
  cleanup?: () => void
}

const props = defineProps<{ target: ThemeAppearanceTarget }>()

function setOptional<K extends keyof UserPageAppearanceTheme>(key: K, value: UserPageAppearanceTheme[K] | undefined) {
  const theme = props.target.get()
  if (value === undefined || value === '') {
    if (theme) delete theme[key]
    props.target.cleanup?.()
    return
  }
  Object.assign(props.target.ensure(), { [key]: value })
}

function optionalModel<K extends keyof UserPageAppearanceTheme>(key: K) {
  return computed<UserPageAppearanceTheme[K] | undefined>({
    get: () => props.target.get()?.[key],
    set: (value) => setOptional(key, value),
  })
}

const radius = computed<number | null>({
  get: () => props.target.get()?.radius ?? null,
  set: (value) => setOptional('radius', value ?? undefined),
})
const surfaceOpacity = computed<number | null>({
  get: () => props.target.get()?.surfaceOpacity ?? null,
  set: (value) => setOptional('surfaceOpacity', value ?? undefined),
})
const borderStrength = optionalModel('borderStrength')
const borderStyle = optionalModel('borderStyle')
const shadowLevel = optionalModel('shadowLevel')
const spacing = optionalModel('spacing')
const controlSize = optionalModel('controlSize')
const pageMaxWidth = computed({
  get: () => props.target.get()?.pageMaxWidth ?? '',
  set: (value: string) => setOptional('pageMaxWidth', value.trim() || undefined),
})

const advancedKeys: Array<keyof UserPageAppearanceTheme> = [
  'radius',
  'borderStrength',
  'borderStyle',
  'shadowLevel',
  'surfaceOpacity',
  'spacing',
  'controlSize',
  'pageMaxWidth',
]
const hasAdvancedSettings = computed(() => advancedKeys.some((key) => props.target.get()?.[key] !== undefined))

function clearAdvancedSettings() {
  const theme = props.target.get()
  if (!theme) return
  advancedKeys.forEach((key) => delete theme[key])
  props.target.cleanup?.()
}
</script>

<template>
  <div class="advanced-options">
    <details>
      <summary>高级选项</summary>
      <span class="builder-text advanced-hint"> 未设置的项目会继承上级主题或使用站点默认值。 </span>
      <PropsGrid :min-item-width="210">
        <UFormField label="圆角大小">
          <div class="builder-row">
            <UInputNumber
              v-model="radius"
              :min="0"
              :max="32"
              placeholder="默认 6px"
            /><span>px</span>
          </div>
        </UFormField>
        <UFormField label="边框强度">
          <USelect
            v-model="borderStrength"
            clearable
            placeholder="继承（标准）"
            :items="[
              { label: '无边框', value: 'none' },
              { label: '轻微', value: 'subtle' },
              { label: '标准', value: 'normal' },
              { label: '明显', value: 'strong' },
            ]"
          />
        </UFormField>
        <UFormField label="边框样式">
          <USelect
            v-model="borderStyle"
            clearable
            placeholder="继承（实线）"
            :items="[
              { label: '实线', value: 'solid' },
              { label: '虚线', value: 'dashed' },
            ]"
          />
        </UFormField>
        <UFormField label="阴影层级">
          <USelect
            v-model="shadowLevel"
            clearable
            placeholder="继承（标准）"
            :items="[
              { label: '无阴影', value: 'none' },
              { label: '轻微', value: 'subtle' },
              { label: '标准', value: 'normal' },
              { label: '悬浮', value: 'floating' },
            ]"
          />
        </UFormField>
        <UFormField label="表面不透明度">
          <div class="builder-row">
            <UInputNumber
              v-model="surfaceOpacity"
              :min="15"
              :max="100"
              placeholder="跟随主题"
            /><span>%</span>
          </div>
        </UFormField>
        <UFormField label="布局密度">
          <USelect
            v-model="spacing"
            clearable
            placeholder="继承（标准）"
            :items="[
              { label: '紧凑', value: 'compact' },
              { label: '标准', value: 'normal' },
              { label: '宽松', value: 'relaxed' },
            ]"
          />
        </UFormField>
        <UFormField label="组件尺寸">
          <USelect
            v-model="controlSize"
            clearable
            placeholder="继承（标准）"
            :items="[
              { label: '紧凑', value: 'compact' },
              { label: '标准', value: 'normal' },
              { label: '舒适', value: 'comfortable' },
            ]"
          />
        </UFormField>
        <UFormField label="内容最大宽度">
          <UInput
            v-model="pageMaxWidth"
            clearable
            placeholder="默认 820px；例如 100% / 1200px"
          />
        </UFormField>
      </PropsGrid>
      <div class="advanced-actions">
        <UButton
          size="sm"
          variant="soft"
          :disabled="!hasAdvancedSettings"
          @click="clearAdvancedSettings"
        >
          恢复高级选项默认值
        </UButton>
      </div>
    </details>
  </div>
</template>

<style scoped>
.advanced-options {
  margin-top: 8px;
  border-top: 1px solid var(--vtsuru-border);
}

.advanced-hint {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
}

.advanced-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
