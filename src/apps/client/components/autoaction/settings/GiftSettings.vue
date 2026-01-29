<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NButton, NInput, NInputNumber, NSelect, NFlex, NSwitch, NTag, useMessage, NForm, NFormItem, NText, NTooltip, NIcon } from 'naive-ui';
import { ref } from 'vue'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Info16Regular } from '@vicons/fluent'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

const message = useMessage()

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
    message.warning('此礼物名称已存在')
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
  <div v-if="action.triggerType === TriggerType.GIFT" class="gift-trigger-settings">
    <NForm label-placement="left" :label-width="140" size="small" :show-feedback="false">
      <NFlex vertical :size="16">
        <NFormItem label="礼物过滤模式">
          <NSelect
            v-model:value="action.triggerConfig.filterMode"
            style="width: 220px"
            :options="giftFilterModeOptions"
          />
        </NFormItem>

        <transition name="fade">
          <div v-if="action.triggerConfig.filterMode === 'blacklist' || action.triggerConfig.filterMode === 'whitelist'" class="filter-group">
            <NText depth="3" style="font-size: 12px; margin-bottom: 8px; display: block;">
              {{ action.triggerConfig.filterMode === 'blacklist' ? '以下列表中的礼物将不会触发感谢' : '仅当礼物在以下列表中时才会触发感谢' }}
            </NText>
            <NFlex vertical :size="12">
              <NFlex :wrap="false">
                <NInput
                  v-model:value="tempGiftName"
                  placeholder="输入礼物名称..."
                  size="small"
                  @keyup.enter="addGiftName"
                />
                <NButton size="small" type="primary" secondary @click="addGiftName">
                  添加
                </NButton>
              </NFlex>

              <NFlex :size="8" class="tag-container">
                <template v-if="action.triggerConfig.filterGiftNames && action.triggerConfig.filterGiftNames.length > 0">
                  <NTag
                    v-for="(giftName, index) in action.triggerConfig.filterGiftNames"
                    :key="index"
                    closable
                    size="small"
                    @close="removeGiftName(index)"
                  >
                    {{ giftName }}
                  </NTag>
                </template>
                <NText v-else depth="3" italic style="font-size: 12px;">列表为空</NText>
              </NFlex>
            </NFlex>
          </div>
        </transition>

        <transition name="fade">
          <NFormItem v-if="action.triggerConfig.filterMode === 'value'" label="最低价值 (元)">
            <NInputNumber
              v-model:value="action.triggerConfig.minValue"
              :min="0"
              style="width: 140px"
              placeholder="0"
            >
              <template #suffix>元</template>
            </NInputNumber>
          </NFormItem>
        </transition>

        <NDivider style="margin: 0;" />

        <NFlex :size="24">
          <NFormItem>
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>包含数量 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
                </template>
                在感谢语中使用 {{ '\{\{gift.count\}\}' }} 变量显示礼物数量
              </NTooltip>
            </template>
            <NSwitch v-model:value="action.triggerConfig.includeQuantity" size="small" />
          </NFormItem>
        </NFlex>

        <NFlex vertical :size="12">
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

          <NFormItem label="单人礼物上限">
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>单人礼物上限 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
                </template>
                单个用户在同一次感谢中最多显示的礼物种类数
              </NTooltip>
            </template>
            <NInputNumber
              v-model:value="action.actionConfig.maxItemsPerUser"
              :min="1"
              :max="20"
              style="width: 140px"
            />
          </NFormItem>
        </NFlex>
      </NFlex>
    </NForm>
  </div>
</template>

<style scoped>
.gift-trigger-settings {
  width: 100%;
}

.filter-group {
  padding: 12px;
  background-color: var(--n-color-modal);
  border-radius: var(--n-border-radius);
  border: 1px solid var(--n-divider-color);
}

.tag-container {
  min-height: 28px;
  padding: 4px 8px;
  background-color: var(--n-action-color);
  border-radius: var(--n-border-radius);
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
