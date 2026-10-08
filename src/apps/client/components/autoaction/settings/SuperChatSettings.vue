<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'
import { NInputNumber, NSelect, NFlex, NSwitch, NForm, NFormItem, NTooltip, NIcon, NDivider } from 'naive-ui'

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
  { label: '按价格区间过滤', value: 'price' },
]
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.SUPER_CHAT"
    class="sc-trigger-settings"
  >
    <NForm
      label-placement="left"
      :label-width="140"
      size="small"
      :show-feedback="false"
    >
      <NFlex
        vertical
        :size="16"
      >
        <NFormItem label="SC过滤模式">
          <NSelect
            v-model:value="action.triggerConfig.scFilterMode"
            style="width: 220px"
            :options="scFilterModeOptions"
          />
        </NFormItem>

        <transition name="fade">
          <NFormItem
            v-if="action.triggerConfig.scFilterMode === 'price'"
            label="触发价格区间"
          >
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>价格区间
                    <NIcon
                      :component="Info16Regular"
                      style="vertical-align: -2px"
                  /></span>
                </template>
                仅当 SC 价格在区间内才触发感谢。<br />
                • 最低填 30 元可自动忽略 B 站每日赠送的 2 元免费 SC；<br />
                • 填 2 ~ 29 元可针对 2 元小额 SC 设置专属感谢话术。
              </NTooltip>
            </template>
            <NFlex align="center" :size="8">
              <NInputNumber
                v-model:value="action.triggerConfig.scMinPrice"
                :min="0"
                style="width: 120px"
                placeholder="最低 (如 30)"
              >
                <template #suffix> 元 </template>
              </NInputNumber>
              <span style="color: var(--vtsuru-fg-muted)">至</span>
              <NInputNumber
                v-model:value="action.triggerConfig.scMaxPrice"
                :min="0"
                style="width: 120px"
                placeholder="不限"
              >
                <template #suffix> 元 </template>
              </NInputNumber>
            </NFlex>
          </NFormItem>
        </transition>

        <NDivider style="margin: 0" />

        <NFlex
          vertical
          :size="12"
        >
          <NFormItem label="防止重复发送">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span
                    >防止重复
                    <NIcon
                      :component="Info16Regular"
                      style="vertical-align: -2px"
                  /></span>
                </template>
                同一用户在单次直播中多次发送 SC 仅触发一次感谢
              </NTooltip>
            </template>
            <NSwitch
              v-model:value="action.triggerConfig.preventRepeat"
              size="small"
            />
          </NFormItem>

          <NFormItem label="单次合并上限">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span
                    >单次合并上限
                    <NIcon
                      :component="Info16Regular"
                      style="vertical-align: -2px"
                  /></span>
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
