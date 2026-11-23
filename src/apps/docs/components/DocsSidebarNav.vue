<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { DOC_GROUPS } from '@/apps/docs/registry'

const emit = defineEmits<{
  navigate: []
}>()

const route = useRoute()

const currentSlug = computed(() => {
  const param = route.params.slug
  if (Array.isArray(param)) return param.join('/')
  return typeof param === 'string' ? param : ''
})
</script>

<template>
  <nav
    aria-label="文档目录"
    class="space-y-5 px-3 py-4"
  >
    <RouterLink
      :to="{ name: 'docs-index' }"
      class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150"
      :class="
        route.name === 'docs-index'
          ? 'bg-brand-soft text-brand'
          : 'text-foreground hover:bg-muted/70'
      "
      @click="emit('navigate')"
    >
      <BookOpen class="size-3.5 shrink-0" />
      <span>文档中心总览</span>
    </RouterLink>

    <div
      v-for="group in DOC_GROUPS"
      :key="group.id"
      class="space-y-1.5"
    >
      <div class="px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground">
        {{ group.title }}
      </div>
      <div class="space-y-0.5">
        <RouterLink
          v-for="item in group.items"
          :key="item.slug"
          :to="{ name: 'docs-article', params: { slug: item.slug.split('/') } }"
          class="flex-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors duration-150"
          :class="
            currentSlug === item.slug
              ? 'bg-brand-soft text-brand font-semibold'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          "
          @click="emit('navigate')"
        >
          <span class="truncate">{{ item.title }}</span>
          <span
            v-if="item.badge"
            class="shrink-0 rounded-sm bg-muted px-1 py-0.2 text-[10px] font-medium text-muted-foreground"
          >
            {{ item.badge }}
          </span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
