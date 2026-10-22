<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { uploadPngtuberAsset } from '@/api/pngtuber-assets'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'

const props = defineProps<{ value: string; label: string; disabled?: boolean }>()
const emit = defineEmits<{ change: [value: string] }>()

const url = ref(props.value)
const busy = ref(false)
const dragging = ref(false)
const input = ref<HTMLInputElement>()
let disposed = false
onScopeDispose(() => {
  disposed = true
})
watch(
  () => props.value,
  (value) => {
    url.value = value
  },
)
async function upload(file?: File) {
  if (!file || props.disabled || busy.value) return
  busy.value = true
  try {
    const asset = await uploadPngtuberAsset(file)
    if (!disposed && !props.disabled) emit('change', asset.url)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    busy.value = false
  }
}
function choose(event: Event) {
  const target = event.target as HTMLInputElement
  void upload(target.files?.[0])
  target.value = ''
}
function drop(event: DragEvent) {
  dragging.value = false
  void upload(event.dataTransfer?.files[0])
}
function apply() {
  if (props.disabled) return
  try {
    const next = new URL(url.value.trim())
    if (!['https:', 'http:'].includes(next.protocol)) throw new Error()
    emit('change', next.href)
  } catch {
    toast.error('请输入有效的 HTTP(S) 图片地址')
  }
}
</script>

<template>
  <div
    class="image-slot"
    :class="{ dragging: dragging && !disabled }"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="drop"
  >
    <div class="slot-heading">
      <span class="text-xs font-medium">{{ label }}</span>
      <Popconfirm
        v-if="value"
        title="清除图片"
        @positive-click="emit('change', '')"
      >
        <template #trigger>
          <Button variant="ghost" size="xs" class="h-5 px-1.5 text-[11px] text-destructive hover:text-destructive" :disabled="disabled || busy">
            清除
          </Button>
        </template>
        清除此图片引用？
      </Popconfirm>
    </div>

    <button
      type="button"
      class="image-preview"
      :disabled="disabled || busy"
      :aria-label="`上传${label}`"
      @click="input?.click()"
    >
      <img
        v-if="value"
        :src="value"
        :alt="label"
      />
      <span v-else class="text-xs text-muted-foreground">拖放或选择图片</span>
    </button>

    <input
      ref="input"
      hidden
      type="file"
      accept="image/png,image/apng,image/gif,image/webp"
      :disabled="disabled || busy"
      @change="choose"
    />

    <Button class="w-full" variant="outline" :disabled="disabled || busy" @click="input?.click()">
      {{ value ? '更换图片' : '上传图片' }}
    </Button>

    <div class="flex items-center gap-1">
      <Input size="xs" v-model="url" class="flex-1" placeholder="HTTP(S) 图片外链" :disabled="disabled || busy" @keyup.enter="apply" />
      <Button size="xs" variant="secondary" class="shrink-0" :disabled="disabled || busy || !url.trim()" @click="apply">
        应用
      </Button>
    </div>

    <span class="text-[11px] text-muted-foreground">PNG / APNG / GIF / WebP，最多 16 MB</span>
  </div>
</template>

<style scoped>
.image-slot {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 0;
}
.dragging {
  background: var(--brand-soft);
}
.slot-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.image-preview {
  border: 0;
  border-radius: 4px;
  background: var(--muted);
  color: var(--muted-foreground);
  height: 100px;
  cursor: pointer;
}
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
