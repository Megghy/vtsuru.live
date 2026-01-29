<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NInputNumber, NSelect, NFlex, NSwitch, NForm, NFormItem, NTooltip, NIcon, NDivider } from 'naive-ui';
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Info16Regular } from '@vicons/fluent'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 入场过滤模式选项
const enterFilterModeOptions = [
  { label: '不过滤 (欢迎所有人)', value: 'none' },
  { label: '用户黑名单 (名单内不欢迎)', value: 'blacklist' },
  { label: '用户白名单 (只欢迎名单内)', value: 'whitelist' },
  { label: '仅欢迎舰长', value: 'guard' },
  { label: '仅欢迎佩戴勋章的用户', value: 'medal' },
]
</script>

<template>
  <div v-if="action.triggerType === TriggerType.ENTER" class="enter-trigger-settings">
    <NForm label-placement="left" :label-width="140" size="small" :show-feedback="false">
      <NFlex vertical :size="16">
        <NFormItem label="入场过滤模式">
          <NSelect
            v-model:value="action.triggerConfig.filterMode"
            style="width: 240px"
            :options="enterFilterModeOptions"
          />
        </NFormItem>

        <NDivider style="margin: 0;" />

        <NFlex vertical :size="12">
          <NFormItem label="防止重复发送">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>防止重复 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
                </template>
                同一用户在单次直播中多次进入仅触发一次欢迎
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
                单条欢迎弹幕中最多合并展示的用户数量
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
.enter-trigger-settings {
  width: 100%;
}
</style>
