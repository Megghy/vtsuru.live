<script setup lang="ts">
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NFormItem,
  NInput,
  NInputNumber,
  NPopconfirm,
  NSelect,
  NSpace,
  NSwitch,
} from 'naive-ui'

import type { PngtuberAccessory } from '@/shared/pngtuber/types'

import PngtuberImageSlot from './PngtuberImageSlot.vue'
const props = defineProps<{ accessories: PngtuberAccessory[]; disabled: boolean }>()
const emit = defineEmits<{ change: [value: PngtuberAccessory[]] }>()
function patch(id: string, value: Partial<PngtuberAccessory>) {
  if (!props.disabled)
    emit(
      'change',
      props.accessories.map((a) => (a.id === id ? { ...a, ...value } : a)),
    )
}
function add() {
  if (props.disabled || props.accessories.length >= 12) return
  emit('change', [
    ...props.accessories,
    {
      id: crypto.randomUUID(),
      name: '配件',
      image: '',
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      visible: 'always',
      front: true,
    },
  ])
}
const fields = [
  { key: 'x', label: '水平偏移', min: -2000, max: 2000, step: 1 },
  { key: 'y', label: '垂直偏移', min: -2000, max: 2000, step: 1 },
  { key: 'scale', label: '缩放', min: 0.05, max: 10, step: 0.05 },
  { key: 'rotation', label: '旋转角度', min: -360, max: 360, step: 1 },
] as const
</script>
<template>
  <NSpace vertical>
    <NButton
      size="small"
      :disabled="disabled || accessories.length >= 12"
      @click="add"
      >增加配件（{{ accessories.length }}/12）</NButton
    >
    <NCollapse>
      <NCollapseItem
        v-for="a in accessories"
        :key="a.id"
        :name="a.id"
        :title="a.name || '配件'"
      >
        <NSpace vertical>
          <NInput
            :value="a.name"
            placeholder="配件名称"
            :disabled="disabled"
            @update:value="patch(a.id, { name: $event })"
          />
          <PngtuberImageSlot
            :value="a.image"
            label="配件图片"
            :disabled="disabled"
            @change="patch(a.id, { image: $event })"
          />
          <div class="fields">
            <NFormItem
              v-for="f in fields"
              :key="f.key"
              :label="f.label"
              :show-feedback="false"
              ><NInputNumber
                :value="a[f.key]"
                :min="f.min"
                :max="f.max"
                :step="f.step"
                size="small"
                :disabled="disabled"
                @update:value="(value) => value !== null && patch(a.id, { [f.key]: value })"
            /></NFormItem>
          </div>
          <NSelect
            :value="a.visible"
            :disabled="disabled"
            :options="[
              { label: '始终显示', value: 'always' },
              { label: '说话时显示', value: 'speaking' },
              { label: '静止时显示', value: 'idle' },
            ]"
            @update:value="patch(a.id, { visible: $event })"
          />
          <NSpace align="center"
            ><span>置于立绘前方</span
            ><NSwitch
              :value="a.front"
              :disabled="disabled"
              @update:value="patch(a.id, { front: $event })"
            /><NPopconfirm
              :disabled="disabled"
              @positive-click="
                emit(
                  'change',
                  accessories.filter((item) => item.id !== a.id),
                )
              "
              ><template #trigger
                ><NButton
                  size="small"
                  type="error"
                  :disabled="disabled"
                  >删除配件</NButton
                ></template
              >删除此配件？</NPopconfirm
            ></NSpace
          >
        </NSpace>
      </NCollapseItem>
    </NCollapse>
  </NSpace>
</template>
<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
</style>
