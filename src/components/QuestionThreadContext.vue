<script setup lang="ts">
import type { ResponseQAInfo } from '@/api/generated/model'

defineProps<{
  items: ResponseQAInfo[]
  answerLabel: string
}>()
</script>

<template>
  <ol class="m-0 p-0 list-none space-y-2 border-l-2 border-border pl-2.5 text-xs">
    <li
      v-for="(entry, index) in items"
      :key="entry.id"
      class="space-y-1"
    >
      <p class="m-0 text-muted-foreground whitespace-pre-wrap break-words">
        <span class="font-medium">{{ index === 0 ? '原提问' : `追问 ${index}` }}：</span>{{ entry.question.message }}
      </p>
      <p
        v-if="entry.answer"
        class="m-0 text-foreground/80 whitespace-pre-wrap break-words"
      >
        <span class="font-medium">{{ answerLabel }}：</span>{{ entry.answer.message }}
      </p>
    </li>
  </ol>
</template>
