<script setup lang="ts">
import { ref } from 'vue';
import { NSpace, NInput, NButton, NTag, NSelect, NInputNumber, NSwitch, NCollapseItem, useMessage } from 'naive-ui';
import { AutoActionItem, TriggerType } from '@/client/store/useAutoAction';

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true
  }
});

const message = useMessage();

// 礼物过滤模式选项
const giftFilterModeOptions = [
  { label: '不过滤', value: 'none' },
  { label: '礼物黑名单', value: 'blacklist' },
  { label: '礼物白名单', value: 'whitelist' },
  { label: '最低价值', value: 'value' },
  { label: '过滤免费礼物', value: 'free' }
];

// 礼物名称相关
const tempGiftName = ref('');

// 添加礼物名称到过滤列表
function addGiftName() {
  if (!tempGiftName.value.trim()) return;

  if (!props.action.triggerConfig.filterGiftNames) {
    props.action.triggerConfig.filterGiftNames = [];
  }

  if (!props.action.triggerConfig.filterGiftNames.includes(tempGiftName.value.trim())) {
    props.action.triggerConfig.filterGiftNames.push(tempGiftName.value.trim());
    tempGiftName.value = '';
  } else {
    message.warning('此礼物名称已存在');
  }
}

// 移除礼物名称
function removeGiftName(index: number) {
  if (props.action.triggerConfig.filterGiftNames) {
    props.action.triggerConfig.filterGiftNames.splice(index, 1);
  }
}
</script>

<template>
  <NCollapseItem
    v-if="action.triggerType === TriggerType.GIFT"
    title="礼物触发设置"
  >
    <NSpace vertical>
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>礼物过滤模式:</span>
        <NSelect
          v-model:value="action.triggerConfig.giftFilterMode"
          style="width: 200px"
          :options="giftFilterModeOptions"
        />
      </NSpace>

      <template v-if="action.triggerConfig.giftFilterMode === 'blacklist' || action.triggerConfig.giftFilterMode === 'whitelist'">
        <NSpace>
          <NInput
            v-model:value="tempGiftName"
            placeholder="输入礼物名称"
            @keyup.enter="addGiftName"
          />
          <NButton @click="addGiftName">
            添加
          </NButton>
        </NSpace>

        <NSpace>
          <template v-if="action.triggerConfig.filterGiftNames">
            <NTag
              v-for="(giftName, index) in action.triggerConfig.filterGiftNames"
              :key="index"
              closable
              @close="removeGiftName(index)"
            >
              {{ giftName }}
            </NTag>
          </template>
        </NSpace>
      </template>

      <template v-if="action.triggerConfig.giftFilterMode === 'value'">
        <NSpace
          align="center"
          justify="space-between"
          style="width: 100%"
        >
          <span>最低价值 (元):</span>
          <NInputNumber
            v-model:value="action.triggerConfig.minValue"
            :min="0"
            style="width: 120px"
          />
        </NSpace>
      </template>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>包含礼物数量:</span>
        <NSwitch v-model:value="action.triggerConfig.includeQuantity" />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>每次处理的最大用户数:</span>
        <NInputNumber
          v-model:value="action.actionConfig.maxUsersPerMsg"
          :min="1"
          :max="20"
          style="width: 120px"
        />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>每用户最大礼物种类数:</span>
        <NInputNumber
          v-model:value="action.actionConfig.maxItemsPerUser"
          :min="1"
          :max="10"
          style="width: 120px"
        />
      </NSpace>
    </NSpace>
  </NCollapseItem>
</template>
