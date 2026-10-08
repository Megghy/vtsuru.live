<script setup lang="ts">
import { NButton, NCollapse, NCollapseItem, NFlex, NFormItem, NInput, NInputNumber, NSelect, NTag, NText } from 'naive-ui'
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
const customCount = computed(() => advancedKeys.filter((key) => props.target.get()?.[key] !== undefined).length)
const hasAdvancedSettings = computed(() => customCount.value > 0)

function clearAdvancedSettings() {
  const theme = props.target.get()
  if (!theme) return
  advancedKeys.forEach((key) => delete theme[key])
  props.target.cleanup?.()
}

const radiusPresets = [
  { label: '直角 0px', value: 0 },
  { label: '微圆 6px', value: 6 },
  { label: '圆角 12px', value: 12 },
  { label: '大圆 20px', value: 20 },
]
</script>

<template>
  <NCollapse class="advanced-options">
    <NCollapseItem
      name="appearance"
      title="高级外观选项"
    >
      <template #header-extra>
        <NTag
          size="tiny"
          :type="hasAdvancedSettings ? 'primary' : 'default'"
          :bordered="false"
        >
          {{ hasAdvancedSettings ? `已自定义 ${customCount} 项` : '默认' }}
        </NTag>
      </template>

      <NText
        depth="3"
        class="advanced-hint"
      >
        未设置的项目会继承全局主题或使用站点默认值。
      </NText>
      <PropsGrid :min-item-width="210">
        <NFormItem label="圆角大小">
          <NFlex
            vertical
            :size="4"
            style="width: 100%"
          >
            <NInputNumber
              v-model:value="radius"
              :min="0"
              :max="32"
              clearable
              placeholder="默认 6px"
              style="width: 100%"
            >
              <template #suffix> px </template>
            </NInputNumber>
            <NFlex
              :size="4"
              style="margin-top: 2px"
            >
              <NButton
                v-for="preset in radiusPresets"
                :key="preset.value"
                size="tiny"
                quaternary
                :type="radius === preset.value ? 'primary' : 'default'"
                @click="radius = preset.value"
              >
                {{ preset.label }}
              </NButton>
            </NFlex>
          </NFlex>
        </NFormItem>
        <NFormItem label="边框强度">
          <NSelect
            v-model:value="borderStrength"
            clearable
            placeholder="继承（标准）"
            :options="[
              { label: '无边框', value: 'none' },
              { label: '轻微', value: 'subtle' },
              { label: '标准', value: 'normal' },
              { label: '明显', value: 'strong' },
            ]"
          />
        </NFormItem>
        <NFormItem label="边框样式">
          <NSelect
            v-model:value="borderStyle"
            clearable
            placeholder="继承（实线）"
            :options="[
              { label: '实线 (solid)', value: 'solid' },
              { label: '虚线 (dashed)', value: 'dashed' },
            ]"
          />
        </NFormItem>
        <NFormItem label="阴影层级">
          <NSelect
            v-model:value="shadowLevel"
            clearable
            placeholder="继承（标准）"
            :options="[
              { label: '无阴影', value: 'none' },
              { label: '轻微', value: 'subtle' },
              { label: '标准', value: 'normal' },
              { label: '悬浮立体', value: 'floating' },
            ]"
          />
        </NFormItem>
        <NFormItem label="表面不透明度">
          <NInputNumber
            v-model:value="surfaceOpacity"
            :min="15"
            :max="100"
            clearable
            placeholder="跟随主题"
            style="width: 100%"
          >
            <template #suffix> % </template>
          </NInputNumber>
        </NFormItem>
        <NFormItem label="布局密度">
          <NSelect
            v-model:value="spacing"
            clearable
            placeholder="继承（标准）"
            :options="[
              { label: '紧凑 (compact)', value: 'compact' },
              { label: '标准 (normal)', value: 'normal' },
              { label: '宽松 (relaxed)', value: 'relaxed' },
            ]"
          />
        </NFormItem>
        <NFormItem label="组件尺寸">
          <NSelect
            v-model:value="controlSize"
            clearable
            placeholder="继承（标准）"
            :options="[
              { label: '紧凑 (compact)', value: 'compact' },
              { label: '标准 (normal)', value: 'normal' },
              { label: '舒适 (comfortable)', value: 'comfortable' },
            ]"
          />
        </NFormItem>
        <NFormItem label="内容最大宽度">
          <NInput
            v-model:value="pageMaxWidth"
            clearable
            placeholder="默认 820px；例如 100% / 1200px"
          />
        </NFormItem>
      </PropsGrid>
      <div class="advanced-actions">
        <NButton
          size="small"
          secondary
          :disabled="!hasAdvancedSettings"
          @click="clearAdvancedSettings"
        >
          恢复高级选项默认值
        </NButton>
      </div>
    </NCollapseItem>
  </NCollapse>
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
  margin-top: 6px;
}
</style>
