<script setup lang="ts">
import { NFlex, NText } from 'naive-ui';
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <NFlex
    justify="space-between"
    align="center"
    :wrap="true"
    :size="12"
  >
    <div class="client-page-header__text">
      <div class="client-page-header__title">
        <slot name="title">
          <NText strong>
            {{ title }}
          </NText>
        </slot>
      </div>
      <div v-if="$slots.description || description" class="client-page-header__description">
        <slot name="description">
          {{ description }}
        </slot>
      </div>
    </div>
    <div class="client-page-header__actions">
      <slot name="actions" />
    </div>
  </NFlex>
</template>

<style scoped>
.client-page-header__title :deep(*) {
  font-size: 18px;
  line-height: 1.2;
}

.client-page-header__description {
  margin-top: 2px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.client-page-header__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}
</style>

