<script setup lang="ts">
import { Delete24Filled } from '@vicons/fluent'
import { SyncCircleSharp } from '@vicons/ionicons5'
import { NButton, NIcon, NPopconfirm, NTooltip, useThemeVars } from 'naive-ui'
import { computed } from 'vue'

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

const themeVars = useThemeVars()
const accentColor = computed(() => themeVars.value.errorColor)
const mutedIconColor = computed(() => themeVars.value.textColor3)
const hardDelete = computed(() => props.isDeleted || props.isAdmin)
</script>

<template>
  <div class="forum-action-bar">
    <NTooltip v-if="canManage">
      <template #trigger>
        <NPopconfirm @positive-click="emit('delete')">
          <template #trigger>
            <NButton
              size="small"
              text
              :disabled="!canOperate"
            >
              <template #icon>
                <NIcon
                  :component="Delete24Filled"
                  :color="hardDelete ? accentColor : mutedIconColor"
                />
              </template>
            </NButton>
          </template>
          {{ hardDelete ? hardDeleteConfirm : deleteConfirm }}
        </NPopconfirm>
      </template>
      {{ hardDelete ? '完全' : '' }}删除
    </NTooltip>
    <NTooltip v-if="isDeleted && isAdmin">
      <template #trigger>
        <NPopconfirm @positive-click="emit('restore')">
          <template #trigger>
            <NButton
              size="small"
              text
              :disabled="!canOperate"
            >
              <template #icon>
                <NIcon
                  :component="SyncCircleSharp"
                  :color="mutedIconColor"
                />
              </template>
            </NButton>
          </template>
          {{ restoreConfirm }}
        </NPopconfirm>
      </template>
      恢复
    </NTooltip>
  </div>
</template>

<style scoped>
.forum-action-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
