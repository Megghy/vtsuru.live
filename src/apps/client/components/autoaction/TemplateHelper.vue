<script setup lang="ts">
import { NFlex, NTag, NTooltip, useMessage } from 'naive-ui';
const props = defineProps({
  placeholders: {
    type: Array as () => { name: string, description: string }[],
    required: true,
  },
})

const message = useMessage()

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
    .then(() => {
      message.success('已复制到剪贴板')
    })
    .catch(() => {
      message.error('复制失败')
    })
}
</script>

<template>
  <div class="template-helper">
    <NFlex vertical>
      <NFlex align="center">
        <div style="font-weight: bold">
          可用变量:
        </div>
        <NFlex style="flex-wrap: wrap">
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
        </NFlex>
      </NFlex>
    </NFlex>
  </div>
</template>

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
  background-color: var(--n-code-color);
  padding: 2px 4px;
  border-radius: var(--n-border-radius);
  font-family: monospace;
}
</style>
