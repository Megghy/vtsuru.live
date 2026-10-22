<script setup lang="ts">
import { Add16Regular, Copy16Regular, Search16Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useMessage } from '@/shared/utils'

const props = defineProps({
  placeholders: {
    type: Array as () => { name: string; description: string }[],
    required: true,
  },
})

const emit = defineEmits<{
  (e: 'insert', value: string): void
}>()

const message = useMessage()
const searchText = ref('')

const filteredPlaceholders = computed(() => {
  if (!searchText.value) return props.placeholders
  const lower = searchText.value.toLowerCase()
  return props.placeholders.filter(
    (p) => p.name.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower),
  )
})

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      message.success('已复制')
    })
    .catch(() => {
      message.error('复制失败')
    })
}

function handleInsert(text: string) {
  emit('insert', text)
}
</script>

<template>
  <div class="template-helper flex flex-col gap-2">
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
          class="variable-item flex items-center justify-between"
          @click="handleInsert(item.name)"
        >
          <div class="variable-info min-w-0 pr-2">
            <div class="variable-code truncate">
              {{ item.name }}
            </div>
            <div class="variable-desc truncate">
              {{ item.description }}
            </div>
          </div>
          <div class="variable-actions flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title="复制"
              @click.stop="copyToClipboard(item.name)"
            >
              <Copy16Regular class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title="插入"
              @click.stop="handleInsert(item.name)"
            >
              <Add16Regular class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          v-if="filteredPlaceholders.length === 0"
          class="no-results"
        >
          无匹配变量
        </div>
      </div>
    </ScrollArea>
  </div>
</template>

<style scoped>
.template-helper {
  background-color: var(--muted);
  border-radius: var(--radius);
  padding: 8px;
  border: 1px solid var(--border);
}

.variable-item {
  padding: 6px 8px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background-color 0.2s;
}

.variable-item:hover {
  background-color: var(--muted);
}

.variable-code {
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  color: var(--primary);
}

.variable-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}

.variable-actions {
  opacity: 0.35;
  transition: opacity 0.2s;
}

.variable-item:hover .variable-actions {
  opacity: 1;
}

.no-results {
  text-align: center;
  color: var(--muted-foreground);
  font-size: 12px;
  padding: 12px 0;
}
</style>
