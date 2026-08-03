<script setup lang="ts">
import type { AddressInfo } from '@/api/api-models'

const { size = 'default' } = defineProps<{
  address: AddressInfo | undefined
  size?: 'small' | 'default'
}>()
</script>

<template>
  <span
    v-if="!address"
    class="address-display__unknown"
    >未知</span
  >
  <div
    v-else
    class="address-display"
  >
    <div class="address-display__details">
      <span
        v-if="size !== 'small'"
        class="address-display__location"
      >
        {{ address.province }}<span class="address-display__muted">省</span> {{ address.city
        }}<span class="address-display__muted">市</span> {{ address.district
        }}<span class="address-display__muted">区</span>
        {{ address.street }}
      </span>
      <span class="address-display__line">
        <UBadge
          size="xs"
          color="info"
          label="详细地址"
        />
        <UTooltip :text="address.address">
          <span
            class="address-display__ellipsis"
            :class="{ compact: size === 'small' }"
            >{{ address.address }}</span
          >
        </UTooltip>
      </span>
      <span
        v-if="size !== 'small'"
        class="address-display__line"
      >
        <UBadge
          size="xs"
          color="info"
          label="收货人"
        />
        <span>{{ address.phone }} {{ address.name }}</span>
      </span>
    </div>
    <div class="address-display__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.address-display {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.address-display__details {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.address-display__location {
  color: var(--vtsuru-fg);
}

.address-display__line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--vtsuru-fg-muted);
}

.address-display__muted,
.address-display__unknown {
  color: var(--vtsuru-fg-muted);
}

.address-display__unknown {
  font-style: italic;
}

.address-display__ellipsis {
  overflow: hidden;
  max-width: 1000px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address-display__ellipsis.compact {
  max-width: 120px;
}

.address-display__actions {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
}
</style>
