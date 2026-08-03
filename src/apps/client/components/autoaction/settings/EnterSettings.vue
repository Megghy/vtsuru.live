<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'

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
  <div
    v-if="action.triggerType === TriggerType.ENTER"
    class="enter-trigger-settings"
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
        <UFormField label="入场过滤模式">
          <USelectMenu
            v-model="action.triggerConfig.filterMode"
            style="width: 240px"
            :items="enterFilterModeOptions"
            value-key="value"
          />
        </UFormField>

        <UFormField
          v-if="action.triggerConfig.filterMode === 'medal'"
          label="最低牌子等级"
        >
          <template #label>
            <UTooltip>
              <span
                >最低牌子等级
                <UIcon
                  name="i-lucide-circle"
                  style="vertical-align: -2px"
              /></span>
              <template #content> 仅欢迎佩戴本房勋章且等级达到此值的用户，0 表示不限制等级 </template>
            </UTooltip>
          </template>
          <UInputNumber
            v-model="action.triggerConfig.enterMedalMinLevel"
            :min="0"
            :max="40"
            style="width: 140px"
            placeholder="0"
          />
        </UFormField>

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
                <template #content> 同一用户在单次直播中多次进入仅触发一次欢迎 </template>
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
                <template #content> 单条欢迎弹幕中最多合并展示的用户数量 </template>
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
.enter-trigger-settings {
  width: 100%;
}
</style>
