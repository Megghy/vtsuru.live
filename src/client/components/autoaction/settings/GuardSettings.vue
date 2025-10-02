<script setup lang="ts">
import type { AutoActionItem } from '@/client/store/useAutoAction'
import { NButton, NCollapseItem, NDivider, NInput, NSelect, NSpace, NSwitch, NTag, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { ActionType, TriggerType } from '@/client/store/useAutoAction'

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
  if (!tempGiftCode.value.trim()) return

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
  if (!levelCodes.codes.includes(tempGiftCode.value.trim())) {
    levelCodes.codes.push(tempGiftCode.value.trim())
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
  <NCollapseItem
    v-if="action.triggerType === TriggerType.GUARD"
    title="上舰触发设置"
  >
    <NSpace vertical>
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>防止重复发送:</span>
        <NSwitch v-model:value="action.triggerConfig.preventRepeat" />
      </NSpace>

      <template v-if="action.actionType === ActionType.SEND_PRIVATE_MSG">
        <NDivider title-placement="left">
          礼品码设置
        </NDivider>

        <NSpace>
          <NSelect
            v-model:value="tempGiftCodeLevel"
            style="width: 120px"
            :options="[
              { label: '总督', value: 1 },
              { label: '提督', value: 2 },
              { label: '舰长', value: 3 },
              { label: '通用', value: 0 },
            ]"
          />
          <NInput
            v-model:value="tempGiftCode"
            placeholder="输入礼品码"
            @keyup.enter="addGiftCode"
          />
          <NButton @click="addGiftCode">
            添加
          </NButton>
        </NSpace>

        <div v-if="action.triggerConfig.giftCodes && action.triggerConfig.giftCodes.length > 0">
          <div
            v-for="(levelCodes, levelIndex) in action.triggerConfig.giftCodes"
            :key="levelIndex"
            class="gift-code-section"
          >
            <div class="gift-code-level">
              {{ getGuardLevelName(levelCodes.level) }}礼品码:
            </div>
            <div class="gift-code-list">
              <NTag
                v-for="(code, codeIndex) in levelCodes.codes"
                :key="codeIndex"
                closable
                @close="removeGiftCode(levelIndex, codeIndex)"
              >
                {{ code }}
              </NTag>
            </div>
          </div>
        </div>
      </template>
    </NSpace>
  </NCollapseItem>
</template>

<style scoped>
.gift-code-section {
  margin: 10px 0;
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
