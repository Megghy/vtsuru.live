<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NButton, NDivider, NInput, NSelect, NFlex, NSwitch, NTag, useMessage, NForm, NFormItem, NText, NTooltip, NIcon } from 'naive-ui';
import { ref } from 'vue'
import { ActionType, TriggerType } from '@/apps/client/store/useAutoAction'
import { Info16Regular } from '@vicons/fluent'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

const message = useMessage()

// 舰长礼品码相关
const tempGiftCodeLevel = ref(3) // 默认为舰长等级
const tempGiftCode = ref('')

// 添加礼品码
function addGiftCode() {
  const code = tempGiftCode.value.trim()
  if (!code) return

  if (!props.action.triggerConfig.giftCodes) {
    props.action.triggerConfig.giftCodes = []
  }

  // 查找对应等级的礼品码数组
  let levelCodes = props.action.triggerConfig.giftCodes.find(gc => gc.level === tempGiftCodeLevel.value)

  if (!levelCodes) {
    // 如果没有此等级的礼品码数组，创建一个
    levelCodes = { level: tempGiftCodeLevel.value, codes: [] }
    props.action.triggerConfig.giftCodes.push(levelCodes)
  }

  // 添加礼品码
  if (!levelCodes.codes.includes(code)) {
    levelCodes.codes.push(code)
    tempGiftCode.value = ''
  } else {
    message.warning('此礼品码已存在')
  }
}

// 移除礼品码
function removeGiftCode(levelIndex: number, codeIndex: number) {
  if (props.action.triggerConfig.giftCodes
    && props.action.triggerConfig.giftCodes[levelIndex]
    && props.action.triggerConfig.giftCodes[levelIndex].codes) {
    props.action.triggerConfig.giftCodes[levelIndex].codes.splice(codeIndex, 1)

    // 如果该等级没有礼品码了，移除这个等级
    if (props.action.triggerConfig.giftCodes[levelIndex].codes.length === 0) {
      props.action.triggerConfig.giftCodes.splice(levelIndex, 1)
    }
  }
}

// 舰长等级名称映射
function getGuardLevelName(level: number): string {
  switch (level) {
    case 1: return '总督'
    case 2: return '提督'
    case 3: return '舰长'
    default: return '通用'
  }
}
</script>

<template>
  <div v-if="action.triggerType === TriggerType.GUARD" class="guard-trigger-settings">
    <NForm label-placement="left" :label-width="140" size="small" :show-feedback="false">
      <NFlex vertical :size="16">
        <NFormItem label="防止重复发送">
          <template #label>
            <NTooltip trigger="hover">
              <template #trigger>
                <span>防止重复 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
              </template>
              同一用户在单次直播中多次上舰仅触发一次
            </NTooltip>
          </template>
          <NSwitch v-model:value="action.triggerConfig.preventRepeat" size="small" />
        </NFormItem>

        <transition name="fade">
          <div v-if="action.actionType === ActionType.SEND_PRIVATE_MSG" class="gift-codes-section">
            <NDivider title-placement="left" style="margin-top: 0;">
              <NText strong depth="2">
                私信礼品码库
              </NText>
            </NDivider>

            <NFlex vertical :size="12">
              <NText depth="3" style="font-size: 12px;">
                当操作类型为“发送私信”时，可以设置在私信中发放礼品码。
              </NText>

              <NFlex :wrap="false">
                <NSelect
                  v-model:value="tempGiftCodeLevel"
                  style="width: 100px"
                  size="small"
                  :options="[
                    { label: '总督', value: 1 },
                    { label: '提督', value: 2 },
                    { label: '舰长', value: 3 },
                    { label: '通用', value: 0 },
                  ]"
                />
                <NInput
                  v-model:value="tempGiftCode"
                  placeholder="输入礼品码..."
                  size="small"
                  @keyup.enter="addGiftCode"
                />
                <NButton size="small" type="primary" secondary @click="addGiftCode">
                  添加
                </NButton>
              </NFlex>

              <div v-if="action.triggerConfig.giftCodes && action.triggerConfig.giftCodes.length > 0" class="codes-display">
                <NFlex vertical :size="8">
                  <div
                    v-for="(levelCodes, levelIndex) in action.triggerConfig.giftCodes"
                    :key="levelIndex"
                    class="level-group"
                  >
                    <div class="level-label">
                      <NTag size="tiny" :type="levelCodes.level === 3 ? 'info' : (levelCodes.level === 0 ? 'default' : 'warning')" :bordered="false">
                        {{ getGuardLevelName(levelCodes.level) }}
                      </NTag>
                    </div>
                    <NFlex :size="6" style="flex: 1">
                      <NTag
                        v-for="(code, codeIndex) in levelCodes.codes"
                        :key="codeIndex"
                        closable
                        size="small"
                        @close="removeGiftCode(levelIndex, codeIndex)"
                      >
                        {{ code }}
                      </NTag>
                    </NFlex>
                  </div>
                </NFlex>
              </div>
              <NText v-else depth="3" italic style="font-size: 12px; text-align: center; padding: 12px;">
                暂无库存礼品码
              </NText>
            </NFlex>
          </div>
        </transition>
      </NFlex>
    </NForm>
  </div>
</template>

<style scoped>
.guard-trigger-settings {
  width: 100%;
}

.gift-codes-section {
  padding: 12px;
  background-color: var(--n-color-modal);
  border-radius: var(--n-border-radius);
  border: 1px solid var(--n-divider-color);
}

.gift-code-level {
  font-weight: bold;
  margin-bottom: 5px;
}

.gift-code-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
