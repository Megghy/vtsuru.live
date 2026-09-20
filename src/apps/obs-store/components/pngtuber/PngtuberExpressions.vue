<script setup lang="ts">
import { NButton, NCard, NFormItem, NInput, NInputNumber, NPopconfirm, NSelect, NSpace, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { createExpression, IMAGE_SLOTS } from '@/shared/pngtuber/types'
import type { ImageSlot, PngtuberExpression, PngtuberState } from '@/shared/pngtuber/types'

import PngtuberAccessories from './PngtuberAccessories.vue'
import PngtuberImageSlot from './PngtuberImageSlot.vue'
const props = defineProps<{ state: PngtuberState; disabled: boolean; controlDisabled: boolean }>()
const emit = defineEmits<{ change: [patch: Partial<PngtuberState>]; activate: [expression: PngtuberExpression] }>()
const selected = ref(props.state.defaultExpressionId)
const expression = computed(
  () => props.state.expressions.find((e) => e.id === selected.value) ?? props.state.expressions[0],
)
const options = computed(() => props.state.expressions.map((e) => ({ label: e.name || '未命名表情', value: e.id })))
watch(
  () => props.state.expressions,
  () => {
    if (!props.state.expressions.some((e) => e.id === selected.value)) selected.value = props.state.defaultExpressionId
  },
)
const labels: Record<ImageSlot, string> = {
  idleImage: '静止 / 睁眼',
  speakingImage: '说话 / 睁眼',
  idleBlinkImage: '静止 / 闭眼',
  speakingBlinkImage: '说话 / 闭眼',
}
function patch(value: Partial<PngtuberExpression>) {
  if (!props.disabled)
    emit('change', {
      expressions: props.state.expressions.map((e) => (e.id === expression.value.id ? { ...e, ...value } : e)),
    })
}
function add(copy = false) {
  if (props.disabled || props.state.expressions.length >= 32) return
  const next = copy
    ? {
        ...(JSON.parse(JSON.stringify(expression.value)) as PngtuberExpression),
        id: crypto.randomUUID(),
        name: `${expression.value.name} 副本`,
        hotkey: '',
      }
    : createExpression('新表情')
  next.accessories = next.accessories.map((a) => ({ ...a, id: crypto.randomUUID() }))
  emit('change', { expressions: [...props.state.expressions, next] })
  selected.value = next.id
}
function remove() {
  if (props.disabled || props.state.expressions.length <= 1) return
  const id = expression.value.id
  const expressions = props.state.expressions.filter((e) => e.id !== id)
  emit('change', {
    expressions,
    defaultExpressionId: props.state.defaultExpressionId === id ? expressions[0].id : props.state.defaultExpressionId,
    awayExpressionId: props.state.awayExpressionId === id ? '' : props.state.awayExpressionId,
  })
}
function recordKey(event: KeyboardEvent) {
  if (event.key === 'Tab') return
  event.preventDefault()
  event.stopPropagation()
  if (props.disabled || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
  patch({
    hotkey:
      event.key === 'Backspace' || event.key === 'Delete'
        ? ''
        : [
            ...(event.ctrlKey ? ['Ctrl'] : []),
            ...(event.altKey ? ['Alt'] : []),
            ...(event.shiftKey ? ['Shift'] : []),
            ...(event.metaKey ? ['Meta'] : []),
            event.code,
          ].join('+'),
  })
}
</script>
<template>
  <NCard
    title="表情与配件"
    size="small"
  >
    <NSpace
      vertical
      :size="12"
    >
      <NSelect
        v-model:value="selected"
        :options="options"
      />
      <NSpace
        ><NButton
          size="small"
          :disabled="disabled || state.expressions.length >= 32"
          @click="add()"
          >新增</NButton
        ><NButton
          size="small"
          :disabled="disabled || state.expressions.length >= 32"
          @click="add(true)"
          >复制</NButton
        ><NPopconfirm
          :disabled="disabled || state.expressions.length <= 1"
          @positive-click="remove"
          ><template #trigger
            ><NButton
              size="small"
              type="error"
              :disabled="disabled || state.expressions.length <= 1"
              >删除</NButton
            ></template
          >删除此表情及其配件？</NPopconfirm
        ><NButton
          size="small"
          :disabled="controlDisabled"
          @click="emit('activate', expression)"
          >切换表情</NButton
        ></NSpace
      >
      <NInput
        :value="expression.name"
        :disabled="disabled"
        placeholder="表情名称"
        @update:value="patch({ name: $event })"
      />
      <div class="fields">
        <NFormItem
          label="默认表情"
          :show-feedback="false"
          ><NSelect
            :value="state.defaultExpressionId"
            :options="options"
            :disabled="disabled"
            @update:value="emit('change', { defaultExpressionId: $event })" /></NFormItem
        ><NFormItem
          label="暂离表情"
          :show-feedback="false"
          ><NSelect
            :value="state.awayExpressionId"
            :options="[{ label: '使用默认表情', value: '' }, ...options]"
            :disabled="disabled"
            @update:value="emit('change', { awayExpressionId: $event })"
        /></NFormItem>
      </div>
      <div class="fields">
        <PngtuberImageSlot
          v-for="slot in IMAGE_SLOTS"
          :key="`${expression.id}:${slot}`"
          :value="expression[slot]"
          :label="labels[slot]"
          :disabled="disabled"
          @change="patch({ [slot]: $event })"
        />
      </div>
      <NButton
        size="small"
        :disabled="disabled || !expression.idleImage"
        @click="patch({ speakingImage: expression.idleImage })"
        >将静止立绘用于说话</NButton
      >
      <div class="fields">
        <NFormItem
          label="快捷键（按键录入，退格清除）"
          :show-feedback="false"
          ><NInput
            :value="expression.hotkey"
            readonly
            :disabled="disabled"
            placeholder="点击后按快捷键"
            @keydown="recordKey" /></NFormItem
        ><NFormItem
          label="快捷键模式"
          :show-feedback="false"
          ><NSelect
            :value="expression.hotkeyMode"
            :disabled="disabled"
            :options="[
              { label: '切换', value: 'toggle' },
              { label: '按住', value: 'hold' },
              { label: '定时', value: 'timed' },
            ]"
            @update:value="patch({ hotkeyMode: $event })"
        /></NFormItem>
      </div>
      <NInputNumber
        v-if="expression.hotkeyMode === 'timed'"
        :value="expression.durationMs"
        :disabled="disabled"
        :min="100"
        :max="600000"
        :step="100"
        @update:value="(value) => value !== null && patch({ durationMs: value })"
        ><template #suffix>ms</template></NInputNumber
      >
      <NText depth="3">网页快捷键在本页获得焦点时生效，编辑输入框时暂停。按住模式松开后恢复原表情。</NText>
      <NFormItem
        label="动图播放"
        :show-feedback="false"
        ><NSelect
          :value="expression.playback"
          :disabled="disabled"
          :options="[
            { label: '继续播放', value: 'continue' },
            { label: '激活时重播', value: 'restart' },
            { label: '播放一次', value: 'once' },
          ]"
          @update:value="patch({ playback: $event })"
      /></NFormItem>
      <PngtuberAccessories
        :key="expression.id"
        :accessories="expression.accessories"
        :disabled="disabled"
        @change="patch({ accessories: $event })"
      />
    </NSpace>
  </NCard>
</template>
<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 480px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
