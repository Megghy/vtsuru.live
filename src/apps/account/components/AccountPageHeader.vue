<script setup lang="ts">
import WorkspaceSwitch from '@/apps/manage/components/layout/WorkspaceSwitch.vue'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="account-page-header">
    <div class="account-page-header__titles">
      <h1 class="account-page-header__title">{{ title }}</h1>
      <p
        v-if="subtitle"
        class="account-page-header__subtitle"
      >
        {{ subtitle }}
      </p>
    </div>

    <div class="account-page-header__actions">
      <WorkspaceSwitch />
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.account-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  min-height: 44px;
  padding: 2px 0 6px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.account-page-header__titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.account-page-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--vtsuru-fg);
  letter-spacing: -0.01em;
}

.account-page-header__subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--vtsuru-fg-muted);
  line-height: 1.4;
}

.account-page-header__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

@media (max-width: 640px) {
  .account-page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding-bottom: 8px;
  }

  .account-page-header__actions {
    margin-left: 0;
    justify-content: space-between;
  }
}
</style>
