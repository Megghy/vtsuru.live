<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { VideoCollectCreateModel } from '@/api/api-models'

const props = defineProps<{
  show: boolean
  title: string
  initialValue?: Partial<VideoCollectCreateModel>
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [value: VideoCollectCreateModel]
}>()

const model = ref<VideoCollectCreateModel>(createModel())
const endAtText = computed({
  get: () => new Date(model.value.endAt - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
  set: (value: string) => { model.value.endAt = new Date(value).getTime() },
})

watch(
  () => props.show,
  (show) => {
    if (show) model.value = createModel(props.initialValue)
  },
)

function createModel(value?: Partial<VideoCollectCreateModel>): VideoCollectCreateModel {
  return {
    id: value?.id,
    name: value?.name ?? '',
    description: value?.description ?? '',
    endAt: value?.endAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxVideoCount: value?.maxVideoCount ?? 50,
  }
}

function submit() {
  if (!model.value.name.trim()) return
  if (model.value.endAt < Date.now() + 60 * 60 * 1000) return
  emit('submit', { ...model.value })
}
</script>

<template>
  <UModal :open="show" :title="title" @update:open="emit('update:show', $event)">
    <template #body>
      <form class="collect-form" @submit.prevent="submit">
        <UFormField label="征集名称" required>
          <UInput v-model="model.name" placeholder="例如：三周年回顾视频征集" :maxlength="30" />
        </UFormField>
        <UFormField label="征集说明">
          <UTextarea v-model="model.description" placeholder="说明主题、投稿要求或注意事项" :maxlength="300" :rows="4" />
        </UFormField>
        <div class="collect-form__grid">
          <UFormField label="最大视频数" required>
            <UInputNumber v-model="model.maxVideoCount" :min="1" class="w-full" />
          </UFormField>
          <UFormField label="截止时间" required>
            <input v-model="endAtText" type="datetime-local" class="collect-form__datetime" />
          </UFormField>
        </div>
        <p class="collect-form__hint">截止时间至少需要在当前时间一小时后。</p>
      </form>
    </template>
    <template #footer>
      <div class="collect-form__actions">
        <UButton color="neutral" variant="soft" label="取消" @click="emit('update:show', false)" />
        <UButton :loading="loading" label="保存" @click="submit" />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.collect-form { display: flex; flex-direction: column; gap: 16px; }
.collect-form__grid { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 16px; }
.collect-form__hint { margin: -4px 0 0; color: var(--vtsuru-fg-muted); font-size: 12px; }
.collect-form__datetime { box-sizing: border-box; width: 100%; min-height: 32px; padding: 0 10px; color: var(--vtsuru-fg); background: var(--vtsuru-bg); border: 1px solid var(--vtsuru-border); border-radius: var(--vtsuru-radius-control); }
.collect-form__actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 560px) { .collect-form__grid { grid-template-columns: 1fr; } }
</style>
