<script setup lang="ts">
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next'
import {
  PaginationEllipsis,
  PaginationFirst,
  PaginationLast,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
  PaginationRoot,
} from 'radix-vue'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

const props = withDefaults(
  defineProps<{
    page?: number
    pageSize?: number
    itemCount?: number
    total?: number
    pageSizes?: number[]
    showSizePicker?: boolean
    showQuickJumper?: boolean
    disabled?: boolean
  }>(),
  {
    page: 1,
    pageSize: 20,
    itemCount: 0,
    total: 0,
    pageSizes: () => [10, 20, 50, 100],
    showSizePicker: false,
    showQuickJumper: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:page': [val: number]
  'update:pageSize': [val: number]
}>()

const actualTotal = computed(() => props.total || props.itemCount || 0)
const totalPages = computed(() => Math.max(1, Math.ceil(actualTotal.value / props.pageSize)))

function onPageChange(p: number) {
  emit('update:page', p)
}

function onSizeChange(val: string | number) {
  const size = Number(val)
  emit('update:pageSize', size)
  emit('update:page', 1)
}
</script>

<template>
  <div class="flex items-center justify-between gap-3 text-xs flex-wrap select-none">
    <div class="text-muted-foreground text-[11px]">
      共 {{ actualTotal }} 项
    </div>

    <div class="flex items-center gap-2">
      <div v-if="showSizePicker" class="flex items-center gap-1 w-28">
        <Select
          :model-value="String(pageSize)"
          @update:model-value="onSizeChange"
        >
          <SelectTrigger size="xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="s in pageSizes" :key="s" :value="String(s)">
              {{ s }} 条/页
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PaginationRoot
        :page="page"
        :items-per-page="pageSize"
        :total="actualTotal"
        :sibling-count="1"
        :show-edges="true"
        @update:page="onPageChange"
      >
        <PaginationList v-slot="{ items }" class="flex items-center gap-1">
          <PaginationFirst as-child>
            <Button variant="outline" size="icon" class="size-7" :disabled="page <= 1">
              <ChevronsLeft class="size-3.5" />
            </Button>
          </PaginationFirst>
          <PaginationPrev as-child>
            <Button variant="outline" size="icon" class="size-7" :disabled="page <= 1">
              <ChevronLeft class="size-3.5" />
            </Button>
          </PaginationPrev>

          <template v-for="(item, index) in items">
            <PaginationListItem
              v-if="item.type === 'page'"
              :key="index"
              :value="item.value"
              as-child
            >
              <Button size="icon" :variant="item.value === page ? 'default' : 'outline'" class="size-7" >
                {{ item.value }}
              </Button>
            </PaginationListItem>
            <PaginationEllipsis
              v-else
              :key="item.type"
              :index="index"
              class="flex size-7 items-center justify-center text-muted-foreground"
            >
              &#8230;
            </PaginationEllipsis>
          </template>

          <PaginationNext as-child>
            <Button variant="outline" size="icon" class="size-7" :disabled="page >= totalPages">
              <ChevronRight class="size-3.5" />
            </Button>
          </PaginationNext>
          <PaginationLast as-child>
            <Button variant="outline" size="icon" class="size-7" :disabled="page >= totalPages">
              <ChevronsRight class="size-3.5" />
            </Button>
          </PaginationLast>
        </PaginationList>
      </PaginationRoot>
    </div>
  </div>
</template>
