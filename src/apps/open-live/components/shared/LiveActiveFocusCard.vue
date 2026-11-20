<script setup lang="ts">
import type { Component } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Card, CardContent } from '@/shared/ui/card'

defineProps<{
  badgeLabel: string
  badgeIcon?: Component
  title: string
  subtitle?: string
}>()
</script>

<template>
  <Card class="border-emerald-500/40 bg-emerald-500/5">
    <CardContent class="p-3.5 flex-between gap-3 flex-wrap">
      <div class="flex items-center gap-2.5 min-w-0 flex-wrap">
        <Badge
          variant="success"
          class="gap-1 shrink-0"
        >
          <component
            :is="badgeIcon"
            v-if="badgeIcon"
            class="size-3.5"
          />
          {{ badgeLabel }}
        </Badge>
        <span class="font-semibold text-base text-foreground truncate max-w-xs">
          {{ title }}
        </span>
        <span
          v-if="subtitle"
          class="text-xs text-muted-foreground truncate max-w-48"
        >
          {{ subtitle }}
        </span>
        <slot name="meta" />
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <slot name="actions" />
      </div>
    </CardContent>
  </Card>
</template>
