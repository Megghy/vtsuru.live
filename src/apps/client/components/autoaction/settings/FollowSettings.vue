<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NInputNumber, NFlex, NSwitch, NForm, NFormItem, NTooltip, NIcon } from 'naive-ui';
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Info16Regular } from '@vicons/fluent'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})
</script>

<template>
  <div v-if="action.triggerType === TriggerType.FOLLOW" class="follow-trigger-settings">
    <NForm label-placement="left" :label-width="140" size="small" :show-feedback="false">
      <NFlex vertical :size="16">
        <NFlex vertical :size="12">
          <NFormItem label="防止重复发送">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>防止重复 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
                </template>
                同一用户在单次直播中多次关注仅触发一次感谢
              </NTooltip>
            </template>
            <NSwitch v-model:value="action.triggerConfig.preventRepeat" size="small" />
          </NFormItem>

          <NFormItem label="单次合并上限">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>单次合并上限 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
                </template>
                单条感谢弹幕中最多合并展示的用户数量
              </NTooltip>
            </template>
            <NInputNumber
              v-model:value="action.actionConfig.maxUsersPerMsg"
              :min="1"
              :max="50"
              style="width: 140px"
            />
          </NFormItem>
        </NFlex>
      </NFlex>
    </NForm>
  </div>
</template>

<style scoped>
.follow-trigger-settings {
  width: 100%;
}
</style>
