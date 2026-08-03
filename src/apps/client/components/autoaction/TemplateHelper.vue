<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps({
  placeholders: {
    type: Array as () => { name: string; description: string }[],
    required: true,
  },
})

const emit = defineEmits<{
  (e: 'insert', value: string): void
}>()

const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
const searchText = ref('')

const filteredPlaceholders = computed(() => {
  if (!searchText.value) return props.placeholders
  const lower = searchText.value.toLowerCase()
  return props.placeholders.filter(
    (p) => p.name.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower),
  )
})

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      feedback('success', '已复制')
    })
    .catch(() => {
      feedback('error', '复制失败')
    })
}

function handleInsert(text: string) {
  emit('insert', text)
}
</script>

<template>
  <div class="template-helper">
    <div
      vertical
      :size="8"
    >
      <UInput
        v-model="searchText"
        placeholder="搜索变量..."
        size="small"
        clearable
      >
        <template #leading>
          <UIcon name="i-lucide-circle" />
        </template>
      </UInput>

      <div style="max-height: 200px">
        <div
          vertical
          :size="4"
        >
          <div
            v-for="item in filteredPlaceholders"
            :key="item.name"
            class="variable-item"
            @click="handleInsert(item.name)"
          >
            <div
              justify="space-between"
              align="center"
            >
              <div class="variable-info">
                <div class="variable-code">
                  {{ item.name }}
                </div>
                <div class="variable-desc">
                  {{ item.description }}
                </div>
              </div>
              <div class="variable-actions">
                <UButton
                  size="tiny"
                  variant="ghost"
                  square
                  title="复制"
                  @click.stop="copyToClipboard(item.name)"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                </UButton>
                <UButton
                  size="tiny"
                  variant="ghost"
                  square
                  title="插入"
                  @click.stop="handleInsert(item.name)"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                </UButton>
              </div>
            </div>
          </div>
          <div
            v-if="filteredPlaceholders.length === 0"
            class="no-results"
          >
            无匹配变量
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-helper {
  background-color: var(--vtsuru-bg-inset);
  border-radius: var(--vtsuru-radius);
  padding: 8px;
  border: 1px solid var(--vtsuru-border);
}

.variable-item {
  padding: 6px 8px;
  border-radius: var(--vtsuru-radius);
  cursor: pointer;
  transition: background-color 0.2s;
}

.variable-item:hover {
  background-color: var(--vtsuru-bg-muted);
}

.variable-code {
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  color: var(--vtsuru-primary);
}

.variable-desc {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  margin-top: 2px;
}

.variable-actions {
  opacity: 0.35;
  transition: opacity 0.2s;
  display: flex;
  gap: 2px;
}

.variable-item:hover .variable-actions {
  opacity: 1;
}

.no-results {
  text-align: center;
  color: var(--vtsuru-fg-disabled);
  font-size: 12px;
  padding: 12px 0;
}
</style>
