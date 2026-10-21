<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div class="client-page-header__text">
      <div class="client-page-header__title">
        <slot name="title">
          <span class="font-semibold text-foreground">
            {{ title }}
          </span>
        </slot>
      </div>
      <div
        v-if="$slots.description || description"
        class="client-page-header__description"
      >
        <slot name="description">
          {{ description }}
        </slot>
      </div>
    </div>
    <div class="client-page-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.client-page-header__title :deep(*) {
  font-size: 18px;
  line-height: 1.2;
}

.client-page-header__description {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted-foreground);
}

.client-page-header__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}
</style>
