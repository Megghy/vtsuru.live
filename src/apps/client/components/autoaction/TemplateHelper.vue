<script setup lang="ts">
import { Add16Regular, Copy16Regular, Search16Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useMessage } from '@/shared/utils'

const props = defineProps({
  placeholders: {
    type: Array as () => { name: string; description: string }[],
    default: () => [],
  },
})

const emit = defineEmits<{
  (e: 'insert', text: string): void
}>()

const message = useMessage()
const searchText = ref('')

const filteredPlaceholders = computed(() => {
  if (!searchText.value) return props.placeholders
  const query = searchText.value.toLowerCase()
  return props.placeholders.filter(
    (item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
  )
})

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  message.success('已复制到剪贴板')
}

function handleInsert(text: string) {
  emit('insert', text)
}
</script>

<template>
  <div class="flex flex-col gap-2 p-2 bg-muted rounded-md border border-border">
    <div class="relative">
      <Search16Regular
        class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
      />
      <Input
        v-model="searchText"
        placeholder="搜索变量..."
        class="pl-8"
      />
    </div>

    <ScrollArea class="h-[200px]">
      <div class="flex flex-col gap-1 pr-2">
        <div
          v-for="item in filteredPlaceholders"
          :key="item.name"
          class="group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:bg-muted/80"
          @click="handleInsert(item.name)"
        >
          <div class="min-w-0 pr-2">
            <div class="font-mono text-xs font-bold text-primary truncate">
              {{ item.name }}
            </div>
            <div class="text-xs text-muted-foreground mt-0.5 truncate">
              {{ item.description }}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0 opacity-40 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-card hover:text-foreground"
              title="复制"
              @click.stop="copyToClipboard(item.name)"
            >
              <Copy16Regular class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-card hover:text-foreground"
              title="插入"
              @click.stop="handleInsert(item.name)"
            >
              <Add16Regular class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          v-if="filteredPlaceholders.length === 0"
          class="text-center text-xs text-muted-foreground py-3"
        >
          无匹配变量
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
