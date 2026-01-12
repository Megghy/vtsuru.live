<script setup lang="ts">
import { NButton, NSpace } from 'naive-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { UserPagesSettingsV1 } from '../types'

const props = defineProps<{
  userName: string
  currentSlug?: string
  settings: UserPagesSettingsV1
}>()

const router = useRouter()

const items = computed(() => {
  const pages = props.settings.pages ?? {}
  const list = Object.entries(pages)
    .filter(([, cfg]) => cfg?.navVisible !== false)
    .map(([slug, cfg]) => ({
      slug,
      title: (cfg?.title && cfg.title.trim().length) ? cfg.title.trim() : `/${slug}`,
      order: typeof cfg?.navOrder === 'number' ? cfg.navOrder : 0,
    }))
    .sort((a, b) => (a.order - b.order) || a.slug.localeCompare(b.slug))

  return [
    { slug: undefined as string | undefined, title: '主页', order: Number.NEGATIVE_INFINITY },
    ...list,
  ]
})

function go(slug?: string) {
  const path = slug ? `/@${props.userName}/${slug}` : `/@${props.userName}`
  router.push(path)
}
</script>

<template>
  <NSpace wrap>
    <NButton
      v-for="it in items"
      :key="it.slug || 'home'"
      size="small"
      :type="(it.slug || undefined) === (currentSlug || undefined) ? 'primary' : 'default'"
      @click="go(it.slug)"
    >
      {{ it.title }}
    </NButton>
  </NSpace>
</template>

