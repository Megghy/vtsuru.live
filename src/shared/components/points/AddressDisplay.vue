<script setup lang="ts">
import type { ShippingAddressInfo } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'

const { size = 'default' } = defineProps<{
  address: ShippingAddressInfo | undefined
  size?: 'small' | 'default'
}>()
</script>

<template>
  <span
    v-if="!address"
    class="text-xs italic text-muted-foreground"
  >
    未知
  </span>
  <div
    v-else
    class="flex-between gap-3 text-xs"
  >
    <div class="flex flex-col gap-1 min-w-0 flex-1">
      <div
        v-if="size !== 'small'"
        class="font-medium text-foreground break-words"
      >
        {{ address.province }} {{ address.city }} {{ address.district }} {{ address.street }}
      </div>

      <div class="flex items-center gap-1.5 text-muted-foreground">
        <Badge
          variant="secondary"
          size="xs"
        >
          详细地址
        </Badge>
        <span
          :class="size === 'small' ? 'truncate max-w-32' : 'min-w-0 break-words'"
          :title="address.address"
        >
          {{ address.address }}
        </span>
      </div>

      <div
        v-if="size !== 'small'"
        class="flex items-center gap-1.5 text-muted-foreground"
      >
        <Badge
          variant="secondary"
          size="xs"
        >
          收货人
        </Badge>
        <span class="min-w-0 break-words">{{ address.phone }} {{ address.name }}</span>
      </div>
    </div>

    <div
      v-if="$slots.actions"
      class="flex items-center justify-end shrink-0"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
