<script setup lang="ts">
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'

export interface TransferOption {
  label: string
  value: string
  disabled?: boolean
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    modelValue?: string[]
    value?: string[]
    options?: TransferOption[]
    sourceTitle?: string
    targetTitle?: string
    sourceFilterable?: boolean
    targetFilterable?: boolean
  }>(),
  {
    modelValue: () => [],
    value: () => [],
    options: () => [],
    sourceTitle: '源列表',
    targetTitle: '已选择',
    sourceFilterable: true,
    targetFilterable: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [val: string[]]
  'update:value': [val: string[]]
}>()

const targetValues = computed({
  get: () => props.value.length > 0 ? props.value : props.modelValue,
  set: (val: string[]) => {
    emit('update:modelValue', val)
    emit('update:value', val)
  },
})

const sourceSearch = ref('')
const targetSearch = ref('')

const checkedSourceKeys = ref<string[]>([])
const checkedTargetKeys = ref<string[]>([])

// 源列表项（未被选中且在 options 中）
const sourceOptions = computed(() => {
  const targetSet = new Set(targetValues.value)
  return props.options.filter((opt) => !targetSet.has(opt.value))
})

// 过滤后的源列表项
const filteredSourceOptions = computed(() => {
  const q = sourceSearch.value.trim().toLowerCase()
  if (!q) return sourceOptions.value
  return sourceOptions.value.filter((opt) => opt.label.toLowerCase().includes(q))
})

// 目标列表项
const targetOptions = computed(() => {
  const optMap = new Map(props.options.map((o) => [o.value, o]))
  return targetValues.value
    .map((v) => optMap.get(v) || { label: v, value: v })
})

// 过滤后的目标列表项
const filteredTargetOptions = computed(() => {
  const q = targetSearch.value.trim().toLowerCase()
  if (!q) return targetOptions.value
  return targetOptions.value.filter((opt) => opt.label.toLowerCase().includes(q))
})

// 源列表全选状态
const isSourceAllChecked = computed(() => {
  const available = filteredSourceOptions.value.filter((o) => !o.disabled)
  if (available.length === 0) return false
  return available.every((o) => checkedSourceKeys.value.includes(o.value))
})

function toggleCheckAllSource(checked: boolean) {
  if (checked) {
    const available = filteredSourceOptions.value.filter((o) => !o.disabled)
    checkedSourceKeys.value = [...new Set([...checkedSourceKeys.value, ...available.map((o) => o.value)])]
  } else {
    const visibleKeys = new Set(filteredSourceOptions.value.map((o) => o.value))
    checkedSourceKeys.value = checkedSourceKeys.value.filter((k) => !visibleKeys.has(k))
  }
}

// 目标列表全选状态
const isTargetAllChecked = computed(() => {
  const available = filteredTargetOptions.value.filter((o) => !o.disabled)
  if (available.length === 0) return false
  return available.every((o) => checkedTargetKeys.value.includes(o.value))
})

function toggleCheckAllTarget(checked: boolean) {
  if (checked) {
    const available = filteredTargetOptions.value.filter((o) => !o.disabled)
    checkedTargetKeys.value = [...new Set([...checkedTargetKeys.value, ...available.map((o) => o.value)])]
  } else {
    const visibleKeys = new Set(filteredTargetOptions.value.map((o) => o.value))
    checkedTargetKeys.value = checkedTargetKeys.value.filter((k) => !visibleKeys.has(k))
  }
}

function moveToTarget() {
  if (checkedSourceKeys.value.length === 0) return
  targetValues.value = [...targetValues.value, ...checkedSourceKeys.value]
  checkedSourceKeys.value = []
}

function moveToSource() {
  if (checkedTargetKeys.value.length === 0) return
  const removeSet = new Set(checkedTargetKeys.value)
  targetValues.value = targetValues.value.filter((k) => !removeSet.has(k))
  checkedTargetKeys.value = []
}

function toggleSourceItem(val: string) {
  if (checkedSourceKeys.value.includes(val)) {
    checkedSourceKeys.value = checkedSourceKeys.value.filter((k) => k !== val)
  } else {
    checkedSourceKeys.value.push(val)
  }
}

function toggleTargetItem(val: string) {
  if (checkedTargetKeys.value.includes(val)) {
    checkedTargetKeys.value = checkedTargetKeys.value.filter((k) => k !== val)
  } else {
    checkedTargetKeys.value.push(val)
  }
}
</script>

<template>
  <div class="flex items-center gap-3 w-full h-[460px]">
    <!-- 左侧：源列表 -->
    <div class="flex-1 h-full flex flex-col rounded-lg border border-border bg-card overflow-hidden">
      <div class="p-2.5 border-b flex items-center justify-between bg-muted/20">
        <div class="flex items-center gap-2">
          <Checkbox
            :checked="isSourceAllChecked"
            @update:checked="toggleCheckAllSource"
          />
          <span class="text-xs font-semibold text-foreground">
            {{ sourceTitle }} ({{ filteredSourceOptions.length }}/{{ sourceOptions.length }})
          </span>
        </div>
      </div>

      <div v-if="sourceFilterable" class="p-2 border-b">
        <div class="relative">
          <Search class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input size="xs" v-model="sourceSearch" placeholder="搜索..." class="pl-7.5" />
        </div>
      </div>

      <ScrollArea class="flex-1 p-1">
        <div class="space-y-0.5">
          <div
            v-for="opt in filteredSourceOptions"
            :key="opt.value"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors"
            :class="[
              opt.disabled
                ? 'opacity-40 cursor-not-allowed'
                : checkedSourceKeys.includes(opt.value)
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted text-foreground',
            ]"
            @click="!opt.disabled && toggleSourceItem(opt.value)"
          >
            <Checkbox
              :checked="checkedSourceKeys.includes(opt.value)"
              :disabled="opt.disabled"
              @click.stop
              @update:checked="!opt.disabled && toggleSourceItem(opt.value)"
            />
            <span class="truncate flex-1">{{ opt.label }}</span>
          </div>

          <div
            v-if="filteredSourceOptions.length === 0"
            class="py-12 text-center text-xs text-muted-foreground"
          >
            无匹配项
          </div>
        </div>
      </ScrollArea>
    </div>

    <!-- 中间操作按钮 -->
    <div class="flex flex-col gap-2 shrink-0">
      <Button variant="outline" size="icon" class="size-8" :disabled="checkedSourceKeys.length === 0" @click="moveToTarget" >
        <ChevronRight class="size-4" />
      </Button>
      <Button variant="outline" size="icon" class="size-8" :disabled="checkedTargetKeys.length === 0" @click="moveToSource" >
        <ChevronLeft class="size-4" />
      </Button>
    </div>

    <!-- 右侧：目标列表 -->
    <div class="flex-1 h-full flex flex-col rounded-lg border border-border bg-card overflow-hidden">
      <div class="p-2.5 border-b flex items-center justify-between bg-muted/20">
        <div class="flex items-center gap-2">
          <Checkbox
            :checked="isTargetAllChecked"
            @update:checked="toggleCheckAllTarget"
          />
          <span class="text-xs font-semibold text-foreground">
            {{ targetTitle }} ({{ filteredTargetOptions.length }})
          </span>
        </div>
      </div>

      <div v-if="targetFilterable" class="p-2 border-b">
        <div class="relative">
          <Search class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input size="xs" v-model="targetSearch" placeholder="搜索已选..." class="pl-7.5" />
        </div>
      </div>

      <ScrollArea class="flex-1 p-1">
        <div class="space-y-0.5">
          <div
            v-for="opt in filteredTargetOptions"
            :key="opt.value"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors"
            :class="[
              opt.disabled
                ? 'opacity-40 cursor-not-allowed'
                : checkedTargetKeys.includes(opt.value)
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted text-foreground',
            ]"
            @click="!opt.disabled && toggleTargetItem(opt.value)"
          >
            <Checkbox
              :checked="checkedTargetKeys.includes(opt.value)"
              :disabled="opt.disabled"
              @click.stop
              @update:checked="!opt.disabled && toggleTargetItem(opt.value)"
            />
            <span class="truncate flex-1">{{ opt.label }}</span>
          </div>

          <div
            v-if="filteredTargetOptions.length === 0"
            class="py-12 text-center text-xs text-muted-foreground"
          >
            未选择任何项目
          </div>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>
