<script setup lang="ts">
import { Copy16Regular, Add16Regular, Search16Regular } from '@vicons/fluent'
import { NButton, NFlex, NIcon, NInput, NScrollbar, useMessage } from 'naive-ui';
import { computed, ref } from 'vue'

const props = defineProps({
  placeholders: {
    type: Array as () => { name: string, description: string }[],
    required: true,
  },
})

const emit = defineEmits<{
  (e: 'insert', value: string): void
}>()

const message = useMessage()
const searchText = ref('')

const filteredPlaceholders = computed(() => {
  if (!searchText.value) return props.placeholders
  const lower = searchText.value.toLowerCase()
  return props.placeholders.filter(p => 
    p.name.toLowerCase().includes(lower) || 
    p.description.toLowerCase().includes(lower)
  )
})

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
    .then(() => {
      message.success('已复制')
    })
    .catch(() => {
      message.error('复制失败')
    })
}

function handleInsert(text: string) {
  emit('insert', text)
}
</script>

<template>
  <div class="template-helper">
    <NFlex vertical :size="8">
      <NInput v-model:value="searchText" placeholder="搜索变量..." size="small" clearable>
        <template #prefix>
          <NIcon :component="Search16Regular" />
        </template>
      </NInput>
      
      <NScrollbar style="max-height: 200px">
        <NFlex vertical :size="4">
          <div
            v-for="item in filteredPlaceholders"
            :key="item.name"
            class="variable-item"
            @click="handleInsert(item.name)"
          >
            <NFlex justify="space-between" align="center">
              <div class="variable-info">
                <div class="variable-code">
                  {{ item.name }}
                </div>
                <div class="variable-desc">
                  {{ item.description }}
                </div>
              </div>
              <div class="variable-actions">
                <NButton size="tiny" quaternary circle title="复制" @click.stop="copyToClipboard(item.name)">
                  <template #icon>
                    <NIcon :component="Copy16Regular" />
                  </template>
                </NButton>
                <NButton size="tiny" quaternary circle title="插入" @click.stop="handleInsert(item.name)">
                  <template #icon>
                    <NIcon :component="Add16Regular" />
                  </template>
                </NButton>
              </div>
            </NFlex>
          </div>
          <div v-if="filteredPlaceholders.length === 0" class="no-results">
            无匹配变量
          </div>
        </NFlex>
      </NScrollbar>
    </NFlex>
  </div>
</template>

<style scoped>
.template-helper {
  background-color: var(--n-color-embedded);
  border-radius: var(--n-border-radius);
  padding: 8px;
  border: 1px solid var(--n-border-color);
}

.variable-item {
  padding: 6px 8px;
  border-radius: var(--n-border-radius);
  cursor: pointer;
  transition: background-color 0.2s;
}

.variable-item:hover {
  background-color: var(--n-hover-color);
}

.variable-code {
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  color: var(--n-primary-color);
}

.variable-desc {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 2px;
}

.variable-actions {
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  gap: 2px;
}

.variable-item:hover .variable-actions {
  opacity: 1;
}

.no-results {
  text-align: center;
  color: var(--n-text-color-disabled);
  font-size: 12px;
  padding: 12px 0;
}
</style>
