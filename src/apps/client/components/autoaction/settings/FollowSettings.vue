<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.FOLLOW"
    class="follow-trigger-settings"
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
                <template #content> 同一用户在单次直播中多次关注仅触发一次感谢 </template>
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
.follow-trigger-settings {
  width: 100%;
}
</style>
