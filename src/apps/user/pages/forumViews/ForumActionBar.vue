<script setup lang="ts">
import { Delete24Filled } from '@vicons/fluent'
import { SyncCircleSharp } from '@vicons/ionicons5'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = withDefaults(
  defineProps<{
    canOperate: boolean
    canManage: boolean
    isDeleted?: boolean
    isAdmin?: boolean
    deleteConfirm?: string
    hardDeleteConfirm?: string
    restoreConfirm?: string
  }>(),
  {
    isDeleted: false,
    isAdmin: false,
    deleteConfirm: '确定删除吗',
    hardDeleteConfirm: '确定完全删除吗? 这将无法恢复',
    restoreConfirm: '要恢复吗?',
  },
)

const emit = defineEmits<{
  delete: []
  restore: []
}>()

const hardDelete = computed(() => props.isDeleted || props.isAdmin)
</script>

<template>
  <TooltipProvider>
    <div class="forum-action-bar flex items-center gap-1">
      <Tooltip v-if="canManage">
        <TooltipTrigger as-child>
          <Popconfirm
            :title="hardDelete ? hardDeleteConfirm : deleteConfirm"
            positive-text="确认删除"
            negative-text="取消"
            @positive-click="emit('delete')"
          >
            <template #trigger>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                :class="{ 'text-destructive': hardDelete }"
                :disabled="!canOperate"
              >
                <component
                  :is="Delete24Filled"
                  class="size-3.5"
                />
              </Button>
            </template>
            {{ hardDelete ? hardDeleteConfirm : deleteConfirm }}
          </Popconfirm>
        </TooltipTrigger>
        <TooltipContent class="text-xs">{{ hardDelete ? '完全' : '' }}删除</TooltipContent>
      </Tooltip>

      <Tooltip v-if="isDeleted && isAdmin">
        <TooltipTrigger as-child>
          <Popconfirm
            :title="restoreConfirm"
            positive-text="确认恢复"
            negative-text="取消"
            @positive-click="emit('restore')"
          >
            <template #trigger>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 rounded-full text-muted-foreground hover:text-foreground"
                :disabled="!canOperate"
              >
                <component
                  :is="SyncCircleSharp"
                  class="size-3.5"
                />
              </Button>
            </template>
            {{ restoreConfirm }}
          </Popconfirm>
        </TooltipTrigger>
        <TooltipContent class="text-xs">恢复</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.forum-action-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
