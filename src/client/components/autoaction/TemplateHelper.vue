<template>
  <div class="template-helper">
    <NSpace vertical>
      <NSpace align="center">
        <div style="font-weight: bold">
          可用变量:
        </div>
        <NSpace style="flex-wrap: wrap">
          <NTooltip
            v-for="item in props.placeholders"
            :key="item.name"
            trigger="hover"
          >
            <template #trigger>
              <NTag
                :bordered="false"
                type="info"
                size="small"
                style="cursor: pointer"
                @click="copyToClipboard(item.name)"
              >
                {{ item.name }}
              </NTag>
            </template>
            {{ item.description }}
          </NTooltip>
        </NSpace>
      </NSpace>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent';
import { NSpace, NTag, NAlert, NTooltip, NIcon, useMessage, NDivider } from 'naive-ui';

const props = defineProps({
  placeholders: {
    type: Array as () => { name: string; description: string }[],
    required: true
  }
});

const message = useMessage();

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
    .then(() => {
      message.success('已复制到剪贴板');
    })
    .catch(() => {
      message.error('复制失败');
    });
}
</script>

<style scoped>
.template-helper {
  margin-bottom: 16px;
}

.alert-header {
  display: flex;
  align-items: center;
  font-weight: bold;
}

code {
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
}
</style>