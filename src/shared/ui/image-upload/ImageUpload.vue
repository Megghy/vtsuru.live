<script setup lang="ts">
import { Image24Regular } from '@vicons/fluent'
import { X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import { fileFingerprint, useFilePicker } from '@/composables/useFilePicker'

import type { UploadImageItem } from './types'
import { acquireFilePreviewUrl, createLocalImageItem, peekFilePreviewUrl, releaseFilePreviewUrl } from './utils'

const props = withDefaults(
  defineProps<{
    modelValue?: UploadImageItem[]
    maxFiles?: number
    maxSize?: number
    accept?: string | readonly string[]
    disabled?: boolean
    size?: 'xs' | 'sm' | 'md' | 'grid'
    gridClass?: string
    placeholder?: string
    dedupe?: boolean
  }>(),
  {
    modelValue: () => [],
    maxSize: 10 * 1024 * 1024,
    accept: 'image/*',
    disabled: false,
    size: 'md',
    gridClass: 'grid-cols-4 sm:grid-cols-6',
    dedupe: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [items: UploadImageItem[]]
}>()

const containerRef = ref<HTMLElement | null>(null)
const retainedUrls = reactive(new Map<File, string>())

function syncRetainedPreviews(items: readonly UploadImageItem[]) {
  const nextFiles = new Set<File>()
  for (const item of items) {
    if (item.kind !== 'local') continue
    nextFiles.add(item.file)
    let url = retainedUrls.get(item.file)
    if (!url) {
      url = acquireFilePreviewUrl(item.file)
      retainedUrls.set(item.file, url)
    } else {
      url = peekFilePreviewUrl(item.file) ?? url
      retainedUrls.set(item.file, url)
    }
    item.url = url
  }
  for (const oldFile of [...retainedUrls.keys()]) {
    if (!nextFiles.has(oldFile)) {
      releaseFilePreviewUrl(oldFile)
      retainedUrls.delete(oldFile)
    }
  }
}

function resolveItemUrl(item: UploadImageItem): string {
  return item.kind === 'local' ? (retainedUrls.get(item.file) ?? item.url) : item.url
}

watch(
  () => props.modelValue,
  (items) => syncRetainedPreviews(items ?? []),
  { immediate: true },
)

onBeforeUnmount(() => {
  for (const file of retainedUrls.keys()) {
    releaseFilePreviewUrl(file)
  }
  retainedUrls.clear()
})

const canAddMore = computed(() => {
  if (props.maxFiles === undefined) return true
  return (props.modelValue?.length ?? 0) < props.maxFiles
})

const isMultiple = computed(() => (props.maxFiles ?? 2) > 1)

function appendFiles(files: File[]) {
  if (props.disabled || !files.length) return
  const current = props.modelValue ?? []
  const newItems = files.map((file) => createLocalImageItem(file))
  const next = props.maxFiles === 1 ? newItems.slice(0, 1) : [...current, ...newItems]
  const capped = props.maxFiles !== undefined ? next.slice(0, props.maxFiles) : next
  syncRetainedPreviews(capped)
  emit('update:modelValue', capped)
}

const existingFingerprints = computed(() => {
  const set = new Set<string>()
  for (const item of props.modelValue ?? []) {
    if (item.kind === 'local') set.add(fileFingerprint(item.file))
  }
  return set
})

const { open, isOverDropZone } = useFilePicker({
  dropZoneRef: containerRef,
  resolveOptions: () => {
    if (props.disabled || (props.maxFiles !== 1 && !canAddMore.value)) return false
    const remaining =
      props.maxFiles === 1
        ? 1
        : props.maxFiles !== undefined
          ? props.maxFiles - (props.modelValue?.length ?? 0)
          : undefined
    return {
      accept: props.accept,
      multiple: isMultiple.value,
      maxSize: props.maxSize,
      maxFiles: remaining,
      dedupe: props.dedupe,
      existingFingerprints: existingFingerprints.value,
    }
  },
  onSelect: appendFiles,
})

function triggerPick() {
  open()
}

function removeAt(index: number) {
  if (props.disabled) return
  const next = [...(props.modelValue ?? [])]
  next.splice(index, 1)
  syncRetainedPreviews(next)
  emit('update:modelValue', next)
}

const containerClasses = computed(() => {
  if (props.size === 'grid') return `grid gap-2 ${props.gridClass}`
  return 'flex items-center gap-2 flex-wrap'
})

const slotSizeClasses = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'size-12 rounded'
    case 'sm':
      return 'size-16 rounded-md'
    case 'grid':
      return 'aspect-square rounded-md'
    case 'md':
    default:
      return 'size-20 rounded-md'
  }
})

const iconSizeClasses = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'size-4'
    case 'sm':
      return 'size-5'
    default:
      return 'size-6 mb-0.5'
  }
})

const labelText = computed(() => {
  if (props.size === 'xs') return ''
  return props.placeholder ?? (props.size === 'sm' ? '添加' : '上传图片')
})
</script>

<template>
  <div
    ref="containerRef"
    :class="containerClasses"
  >
    <div
      v-for="(item, index) in modelValue"
      :key="item.id"
      class="relative border border-border overflow-hidden group bg-muted/20"
      :class="slotSizeClasses"
    >
      <img
        :src="resolveItemUrl(item)"
        :alt="item.name"
        class="size-full object-cover"
      />
      <button
        v-if="!disabled"
        type="button"
        :aria-label="`移除 ${item.name}`"
        class="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-center"
        @click.stop="removeAt(index)"
      >
        <X :class="size === 'xs' ? 'size-2.5' : 'size-3'" />
      </button>
    </div>

    <button
      v-if="canAddMore"
      type="button"
      :disabled="disabled"
      :title="placeholder || '添加图片'"
      class="flex-col-center border border-dashed text-muted-foreground hover:border-primary hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer p-1 text-center disabled:opacity-50 disabled:pointer-events-none"
      :class="[slotSizeClasses, isOverDropZone && !disabled ? 'border-primary bg-primary/5 text-primary' : 'border-input bg-background/50']"
      @click="triggerPick"
    >
      <Image24Regular
        class="text-muted-foreground/70"
        :class="iconSizeClasses"
      />
      <span
        v-if="labelText"
        class="text-[10px] leading-tight mt-0.5"
      >
        {{ labelText }}
      </span>
    </button>
  </div>
</template>
