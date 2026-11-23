<script setup lang="ts">
import { Copy, Plus, Search } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'

const props = defineProps<{
  placeholders: { name: string; description: string }[]
}>()

const emit = defineEmits<{
  (e: 'insert', text: string): void
}>()

const searchText = ref('')

const filteredPlaceholders = computed(() => {
  if (!searchText.value) return props.placeholders
  const query = searchText.value.toLowerCase()
  return props.placeholders.filter(
    (item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
  )
})

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text)
  toast.success('已复制到剪贴板')
}

function handleInsert(text: string) {
  emit('insert', text)
}
</script>

<template>
  <div class="flex flex-col gap-2 p-2 bg-muted/40 rounded-md border border-border">
    <div class="relative">
      <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
      <Input
        v-model="searchText"
        placeholder="搜索变量..."
        class="pl-8"
      />
    </div>

    <ScrollArea class="h-[200px] [&_[data-reka-scroll-area-viewport]>div]:!block">
      <div class="flex flex-col gap-1 pr-2">
        <div
          v-for="item in filteredPlaceholders"
          :key="item.name"
          class="group flex-between py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:bg-muted"
          @click="handleInsert(item.name)"
        >
          <div class="min-w-0 pr-2">
            <div class="font-mono text-xs font-semibold text-primary truncate">
              {{ item.name }}
            </div>
            <div class="text-[11px] text-muted-foreground mt-0.5 truncate">
              {{ item.description }}
            </div>
          </div>
          <div class="flex items-center gap-0.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground"
              aria-label="复制变量"
              @click.stop="copyToClipboard(item.name)"
            >
              <Copy class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground"
              aria-label="插入变量"
              @click.stop="handleInsert(item.name)"
            >
              <Plus class="size-3.5" />
            </Button>
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
