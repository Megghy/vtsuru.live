<script setup lang="ts">
import { NSpace, NDivider, NInputNumber, NRadioGroup, NRadio } from 'naive-ui';
import CommonConfigItems from './CommonConfigItems.vue';
import TemplateEditor from './TemplateEditor.vue';
import { ScheduledDanmakuConfig } from '@/client/store/useAutoAction';

const props = defineProps({
  config: {
    type: Object as () => ScheduledDanmakuConfig,
    required: true
  }
});

const modeOptions = [
  { label: '随机模式', value: 'random' },
  { label: '顺序模式', value: 'sequential' }
];
</script>

<template>
  <div class="scheduled-danmaku-config">
    <CommonConfigItems
      :config="config"
      :show-live-only="true"
      :show-delay="false"
      :show-user-filter="false"
      :show-tian-xuan="false"
    />

    <NDivider title-placement="left">
      定时弹幕设置
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
        <span>发送间隔 (秒):</span>
        <NInputNumber
          v-model:value="config.intervalSeconds"
          :min="60"
          :max="3600"
          style="width: 120px"
        />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>发送模式:</span>
        <NRadioGroup v-model:value="config.mode">
          <NSpace>
            <NRadio
              v-for="option in modeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </NRadio>
          </NSpace>
        </NRadioGroup>
      </NSpace>

      <TemplateEditor
        :templates="config.messages"
        title="弹幕内容列表"
        description="每条消息将按照设定的模式定时发送"
      />
    </NSpace>
  </div>
</template>
