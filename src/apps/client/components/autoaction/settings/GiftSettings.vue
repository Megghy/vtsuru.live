<script setup lang="ts">
import { ref } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}

// 礼物过滤模式选项
const giftFilterModeOptions = [
  { label: '不过滤', value: 'none' },
  { label: '礼物黑名单 (不感谢这些礼物)', value: 'blacklist' },
  { label: '礼物白名单 (只感谢这些礼物)', value: 'whitelist' },
  { label: '按最低价值过滤', value: 'value' },
  { label: '过滤所有免费礼物', value: 'free' },
]

// 礼物名称相关
const tempGiftName = ref('')

// 添加礼物名称到过滤列表
function addGiftName() {
  const name = tempGiftName.value.trim()
  if (!name) return

  if (!props.action.triggerConfig.filterGiftNames) {
    props.action.triggerConfig.filterGiftNames = []
  }

  if (!props.action.triggerConfig.filterGiftNames.includes(name)) {
    props.action.triggerConfig.filterGiftNames.push(name)
    tempGiftName.value = ''
  } else {
    feedback('warning', '此礼物名称已存在')
  }
}

// 移除礼物名称
function removeGiftName(index: number) {
  if (props.action.triggerConfig.filterGiftNames) {
    props.action.triggerConfig.filterGiftNames.splice(index, 1)
  }
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.GIFT"
    class="gift-trigger-settings"
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
        <UFormField label="礼物过滤模式">
          <USelectMenu
            v-model="action.triggerConfig.filterMode"
            style="width: 220px"
            :items="giftFilterModeOptions"
            value-key="value"
          />
        </UFormField>

        <transition name="fade">
          <div
            v-if="action.triggerConfig.filterMode === 'blacklist' || action.triggerConfig.filterMode === 'whitelist'"
            class="filter-group"
          >
            <span
              depth="3"
              style="font-size: 12px; margin-bottom: 8px; display: block"
            >
              {{
                action.triggerConfig.filterMode === 'blacklist'
                  ? '以下列表中的礼物将不会触发感谢'
                  : '仅当礼物在以下列表中时才会触发感谢'
              }}
            </span>
            <div
              vertical
              :size="12"
            >
              <div :wrap="false">
                <UInput
                  v-model="tempGiftName"
                  placeholder="输入礼物名称..."
                  size="small"
                  @keyup.enter="addGiftName"
                />
                <UButton
                  size="small"
                  color="primary"
                  variant="soft"
                  @click="addGiftName"
                >
                  添加
                </UButton>
              </div>

              <div
                :size="8"
                class="tag-container"
              >
                <template
                  v-if="action.triggerConfig.filterGiftNames && action.triggerConfig.filterGiftNames.length > 0"
                >
                  <UBadge
                    v-for="(giftName, index) in action.triggerConfig.filterGiftNames"
                    :key="index"
                    closable
                    size="small"
                    @close="removeGiftName(index)"
                  >
                    {{ giftName }}
                  </UBadge>
                </template>
                <span
                  v-else
                  depth="3"
                  italic
                  style="font-size: 12px"
                >
                  列表为空
                </span>
              </div>
            </div>
          </div>
        </transition>

        <transition name="fade">
          <UFormField
            v-if="action.triggerConfig.filterMode === 'value'"
            label="最低价值 (元)"
          >
            <div class="flex items-center gap-2">
              <UInputNumber
                v-model="action.triggerConfig.minValue"
                :min="0"
                style="width: 140px"
                placeholder="0"
              />
              <span class="text-sm text-[var(--vtsuru-fg-muted)]">元</span>
            </div>
          </UFormField>
        </transition>

        <USeparator style="margin: 0" />

        <div :size="24">
          <UFormField>
            <template #label>
              <UTooltip>
                <span
                  >包含数量
                  <UIcon
                    name="i-lucide-circle"
                    style="vertical-align: -2px"
                /></span>
                <template #content> 在感谢语中使用 {{ '\{\{gift.count\}\}' }} 变量显示礼物数量 </template>
              </UTooltip>
            </template>
            <USwitch
              v-model="action.triggerConfig.includeQuantity"
              size="small"
            />
          </UFormField>
        </div>

        <div
          vertical
          :size="12"
        >
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

          <UFormField label="单人礼物上限">
            <template #label>
              <UTooltip>
                <span
                  >单人礼物上限
                  <UIcon
                    name="i-lucide-circle"
                    style="vertical-align: -2px"
                /></span>
                <template #content> 单个用户在同一次感谢中最多显示的礼物种类数 </template>
              </UTooltip>
            </template>
            <UInputNumber
              v-model="action.actionConfig.maxItemsPerUser"
              :min="1"
              :max="20"
              style="width: 140px"
            />
          </UFormField>
        </div>
      </div>
    </UForm>
  </div>
</template>

<style scoped>
.gift-trigger-settings {
  width: 100%;
}

.filter-group {
  padding: 12px;
  background-color: var(--vtsuru-bg-elevated);
  border-radius: var(--vtsuru-radius);
  border: 1px solid var(--vtsuru-border);
}

.tag-container {
  min-height: 28px;
  padding: 4px 8px;
  background-color: var(--vtsuru-bg-muted);
  border-radius: var(--vtsuru-radius);
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
