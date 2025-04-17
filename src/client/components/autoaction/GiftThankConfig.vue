<script setup lang="ts">
import { NCard, NSpace, NDivider, NSelect, NInputNumber, NSwitch, NRadioGroup, NRadio } from 'naive-ui';
import CommonConfigItems from './CommonConfigItems.vue';
import TemplateEditor from './TemplateEditor.vue';
import { GiftThankConfig } from '@/client/store/useAutoAction';

const props = defineProps({
  config: {
    type: Object as () => GiftThankConfig,
    required: true
  }
});

const filterModeOptions = [
  { label: '不过滤', value: 'none' },
  { label: '礼物黑名单', value: 'blacklist' },
  { label: '礼物白名单', value: 'whitelist' },
  { label: '最低价值', value: 'value' },
  { label: '过滤免费礼物', value: 'free' }
];

const thankModeOptions = [
  { label: '单用户单礼物', value: 'singleGift' },
  { label: '单用户多礼物', value: 'singleUserMultiGift' },
  { label: '多用户多礼物', value: 'multiUserMultiGift' }
];

const placeholders = [
  { name: '{{user.name}}', description: '用户名称' },
  { name: '{{gift.summary}}', description: '礼物摘要，包含礼物名称和数量' },
  { name: '{{gift.totalPrice}}', description: '礼物总价值' }
];
</script>

<template>
  <div class="gift-thank-config">
    <CommonConfigItems
      :config="config"
      :show-live-only="true"
      :show-delay="true"
      :show-user-filter="true"
      :show-tian-xuan="true"
    />

    <NDivider title-placement="left">
      礼物过滤设置
    </NDivider>

    <NSpace
      vertical
      size="medium"
    >
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>过滤模式:</span>
        <NSelect
          v-model:value="config.filterMode"
          :options="filterModeOptions"
          style="width: 200px"
        />
      </NSpace>

      <NSpace
        v-if="config.filterMode === 'value'"
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>最低价值 (元):</span>
        <NInputNumber
          v-model:value="config.minValue"
          :min="0"
          :precision="2"
          style="width: 120px"
        />
      </NSpace>

      <TemplateEditor
        :templates="config.filterGiftNames"
        title="礼物名称列表"
        :description="config.filterMode === 'blacklist' ? '以下礼物将被过滤不触发感谢' : config.filterMode === 'whitelist' ? '只有以下礼物会触发感谢' : '请添加礼物名称'"
      />
    </NSpace>

    <NDivider title-placement="left">
      感谢设置
    </NDivider>

    <NSpace
      vertical
      size="medium"
    >
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>感谢模式:</span>
        <NRadioGroup v-model:value="config.thankMode">
          <NSpace>
            <NRadio
              v-for="option in thankModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </NRadio>
          </NSpace>
        </NRadioGroup>
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>每次感谢最大用户数:</span>
        <NInputNumber
          v-model:value="config.maxUsersPerMsg"
          :min="1"
          :max="20"
          style="width: 120px"
        />
      </NSpace>

      <NSpace
        v-if="config.thankMode === 'singleUserMultiGift'"
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>每用户最大礼物数:</span>
        <NInputNumber
          v-model:value="config.maxGiftsPerUser"
          :min="1"
          :max="10"
          style="width: 120px"
        />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>包含礼物数量:</span>
        <NSwitch v-model:value="config.includeQuantity" />
      </NSpace>

      <TemplateEditor
        :templates="config.templates"
        title="感谢模板"
        description="可以使用变量来个性化感谢内容"
        :placeholders="placeholders"
      />
    </NSpace>
  </div>
</template>
