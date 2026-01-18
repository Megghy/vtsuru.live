<script setup lang="ts">
import { NAlert } from 'naive-ui';
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

function asObject(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as any
}

const propsObj = computed(() => asObject(props.blockProps) ?? {})

const type = computed<'default' | 'info' | 'success' | 'warning' | 'error'>(() => {
  const v = propsObj.value.type
  if (v === 'info' || v === 'success' || v === 'warning' || v === 'error' || v === 'default') return v
  return 'info'
})

const title = computed(() => (typeof propsObj.value.title === 'string' ? propsObj.value.title : ''))
const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))
const showIcon = computed(() => (typeof propsObj.value.showIcon === 'boolean' ? propsObj.value.showIcon : true))
const bordered = computed(() => (typeof propsObj.value.bordered === 'boolean' ? propsObj.value.bordered : false))
const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : true))
const backgrounded = computed(() => (typeof propsObj.value.backgrounded === 'boolean' ? propsObj.value.backgrounded : true))
</script>

<template>
  <BlockCard :framed="framed" :backgrounded="backgrounded" :content-style="{ padding: 0 }">
    <NAlert
      :type="type"
      :title="title || undefined"
      :show-icon="showIcon"
      :bordered="bordered"
      class="vtsuru-alert"
    >
      <div class="alert-content">
        {{ text }}
      </div>
    </NAlert>
  </BlockCard>
</template>

<style scoped>
.vtsuru-alert {
  border-radius: 0;
}

.alert-content {
  white-space: pre-wrap;
  line-height: 1.6;
}

:deep(.n-alert-body__title) {
  font-weight: 700 !important;
}
</style>
