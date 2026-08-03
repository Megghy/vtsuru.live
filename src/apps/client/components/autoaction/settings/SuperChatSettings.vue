<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// SC过滤模式选项
const scFilterModeOptions = [
  { label: '不进行额外过滤', value: 'none' },
  { label: '按最低价格过滤', value: 'price' },
]
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.SUPER_CHAT"
    class="sc-trigger-settings"
  >
    <UForm
      label-placement="left"
      :label-width="140"
      size="small"
      :show-feedback="false"
    >
      <div
        vertical
        :size="16"
      >
        <UFormField label="SC过滤模式">
          <USelectMenu
            v-model="action.triggerConfig.scFilterMode"
            style="width: 220px"
            :items="scFilterModeOptions"
            value-key="value"
          />
        </UFormField>

        <transition name="fade">
          <UFormField
            v-if="action.triggerConfig.scFilterMode === 'price'"
            label="最低价格 (元)"
          >
            <template #label>
              <UTooltip>
                <span
                  >最低价格
                  <UIcon
                    name="i-lucide-circle"
                    style="vertical-align: -2px"
                /></span>
                <template #content> 仅当 SC 价格大于或等于此值时才触发感谢 </template>
              </UTooltip>
            </template>
            <div class="flex items-center gap-2">
              <UInputNumber
                v-model="action.triggerConfig.scMinPrice"
                :min="0"
                style="width: 140px"
                placeholder="0"
              />
              <span class="text-sm text-[var(--vtsuru-fg-muted)]">元</span>
            </div>
          </UFormField>
        </transition>

        <USeparator style="margin: 0" />

        <div
          vertical
          :size="12"
        >
          <UFormField label="防止重复发送">
            <template #label>
              <UTooltip>
                <span
                  >防止重复
                  <UIcon
                    name="i-lucide-circle"
                    style="vertical-align: -2px"
                /></span>
                <template #content> 同一用户在单次直播中多次发送 SC 仅触发一次感谢 </template>
              </UTooltip>
            </template>
            <USwitch
              v-model="action.triggerConfig.preventRepeat"
              size="small"
            />
          </UFormField>

          <UFormField label="单次合并上限">
            <template #label>
              <UTooltip>
                <span
                  >单次合并上限
                  <UIcon
                    name="i-lucide-circle"
                    style="vertical-align: -2px"
                /></span>
                <template #content> 单条感谢弹幕中最多合并展示的用户数量 </template>
              </UTooltip>
            </template>
            <UInputNumber
              v-model="action.actionConfig.maxUsersPerMsg"
              :min="1"
              :max="50"
              style="width: 140px"
            />
          </UFormField>
        </div>
      </div>
    </UForm>
  </div>
</template>

<style scoped>
.sc-trigger-settings {
  width: 100%;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
