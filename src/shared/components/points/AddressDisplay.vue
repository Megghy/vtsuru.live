<script setup lang="ts">
import { ref } from 'vue'

import type { ShippingAddressInfo } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'

const { size = 'default' } = defineProps<{
  address: ShippingAddressInfo | undefined
  size?: 'small' | 'default'
}>()

const elementRef = ref()
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
    ref="elementRef"
    class="flex items-center justify-between gap-3 text-xs"
  >
    <div class="flex flex-col gap-1 min-w-0 flex-1">
      <div
        v-if="size !== 'small'"
        class="font-medium text-foreground truncate"
      >
        {{ address.province }}
        <span class="text-muted-foreground font-normal">省</span>
        {{ address.city }}
        <span class="text-muted-foreground font-normal">市</span>
        {{ address.district }}
        <span class="text-muted-foreground font-normal">区</span>
        {{ address.street }}
      </div>

      <div class="flex items-center gap-1.5 text-muted-foreground">
        <Badge
          variant="secondary"
          class="text-[10px] h-4.5 px-1 font-normal shrink-0"
        >
          详细地址
        </Badge>
        <span
          class="truncate"
          :class="{ 'max-w-32': size === 'small' }"
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
          class="text-[10px] h-4.5 px-1 font-normal shrink-0"
        >
          收货人
        </Badge>
        <span class="truncate">{{ address.phone }} {{ address.name }}</span>
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
