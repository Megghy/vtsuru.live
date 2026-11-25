<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

withDefaults(
  defineProps<{
    tags?: string[] | null
    languages?: string[] | null
    selectedTag?: string | null
    selectedLanguage?: string | null
    maxTags?: number
    maxLanguages?: number
  }>(),
  {
    tags: () => [],
    languages: () => [],
    selectedTag: null,
    selectedLanguage: null,
    maxTags: 3,
    maxLanguages: 2,
  },
)

const emit = defineEmits<{
  toggleTag: [tag: string]
  toggleLanguage: [language: string]
}>()
</script>

<template>
  <div class="inline-flex items-center gap-1 flex-wrap min-w-0">
    <Badge
      v-for="tag in (tags ?? []).slice(0, maxTags)"
      :key="`tag-${tag}`"
      :variant="selectedTag === tag ? 'default' : 'secondary'"
      size="xs"
      role="button"
      tabindex="0"
      :aria-pressed="selectedTag === tag"
      class="cursor-pointer max-w-24 truncate font-normal"
      @click.stop="emit('toggleTag', tag)"
      @keydown.enter.prevent="emit('toggleTag', tag)"
      @keydown.space.prevent="emit('toggleTag', tag)"
    >
      {{ tag }}
    </Badge>
    <span
      v-if="(tags?.length ?? 0) > maxTags"
      class="text-[10px] text-muted-foreground tabular-nums"
    >
      +{{ (tags?.length ?? 0) - maxTags }}
    </span>
    <Badge
      v-for="lang in (languages ?? []).slice(0, maxLanguages)"
      :key="`lang-${lang}`"
      :variant="selectedLanguage === lang ? 'brand' : 'outline'"
      size="xs"
      role="button"
      tabindex="0"
      :aria-pressed="selectedLanguage === lang"
      class="cursor-pointer max-w-20 truncate font-normal"
      @click.stop="emit('toggleLanguage', lang)"
      @keydown.enter.prevent="emit('toggleLanguage', lang)"
      @keydown.space.prevent="emit('toggleLanguage', lang)"
    >
      {{ lang }}
    </Badge>
  </div>
</template>
