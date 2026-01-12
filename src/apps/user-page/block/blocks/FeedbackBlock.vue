<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NText } from 'naive-ui'
import { computed } from 'vue'

interface BlockConfig {
  title?: string
  description?: string
  url?: string
  buttonText?: string
  embed?: boolean
  height?: number
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const height = Number(o.height)
  return {
    title: typeof o.title === 'string' ? o.title : '留言 / 提问',
    description: typeof o.description === 'string' ? o.description : '',
    url: typeof o.url === 'string' ? o.url : '',
    buttonText: typeof o.buttonText === 'string' ? o.buttonText : '打开',
    embed: typeof o.embed === 'boolean' ? o.embed : false,
    height: Number.isFinite(height) ? Math.min(1200, Math.max(200, height)) : 520,
  }
})

const url = computed(() => (cfg.value.url ?? '').trim())
const canEmbed = computed(() => cfg.value.embed && url.value.startsWith('https://'))
</script>

<template>
  <NCard size="small">
    <template #header>
      {{ cfg.title || '留言 / 提问' }}
    </template>

    <NText v-if="cfg.description" depth="3" style="display:block; margin-bottom: 10px; white-space: pre-wrap">
      {{ cfg.description }}
    </NText>

    <NAlert v-if="!url" type="info" :show-icon="false">
      未配置链接（例如棉花糖 / 提问箱）
    </NAlert>

    <template v-else>
      <NFlex align="center" style="gap: 10px; margin-bottom: 10px">
        <NButton
          type="primary"
          secondary
          tag="a"
          target="_blank"
          rel="noopener noreferrer"
          :href="url"
        >
          {{ cfg.buttonText || '打开' }}
        </NButton>
        <NText depth="3" style="min-width:0">
          {{ url }}
        </NText>
      </NFlex>

      <iframe
        v-if="canEmbed"
        :src="url"
        :height="cfg.height"
        style="width: 100%; border: 1px solid var(--n-border-color); border-radius: var(--vtsuru-page-radius);"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
    </template>
  </NCard>
</template>

