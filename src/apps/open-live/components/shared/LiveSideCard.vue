<script setup lang="ts">
import type { Component } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

withDefaults(
  defineProps<{
    title: string
    icon?: Component
    iconClass?: string
    badge?: string | number | null
    badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'brand'
    actionLabel?: string
  }>(),
  {
    iconClass: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
)

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <Card>
    <CardHeader class="p-3.5 pb-2">
      <div class="flex-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <component
            :is="icon"
            v-if="icon"
            class="size-4 shrink-0"
            :class="iconClass"
          />
          <CardTitle class="text-sm truncate">{{ title }}</CardTitle>
          <Badge
            v-if="badge !== undefined && badge !== null && badge !== ''"
            :variant="badgeVariant"
            size="xs"
            class="shrink-0"
          >
            {{ badge }}
          </Badge>
        </div>

        <slot name="header-action">
          <Button
            v-if="actionLabel"
            size="xs"
            variant="ghost"
            class="shrink-0"
            @click="emit('action')"
          >
            {{ actionLabel }}
          </Button>
        </slot>
      </div>
    </CardHeader>

    <CardContent class="p-3.5 pt-0">
      <slot />
    </CardContent>
  </Card>
</template>
