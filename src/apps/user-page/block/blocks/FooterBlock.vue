<script setup lang="ts">
import { NText } from 'naive-ui'
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()
const propsObj = computed<Record<string, any>>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return o
})

const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))
const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : false))
</script>

<template>
  <BlockCard :framed="framed">
    <div class="footer">
      <NText depth="3">
        {{ text || 'Powered by vtsuru.live' }}
      </NText>
    </div>
  </BlockCard>
</template>

<style scoped>
.footer {
  text-align: center;
}
</style>
