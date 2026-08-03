<script setup lang="ts">
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import type { FunctionTypes } from '@/api/api-models'
import { useFunctionToggle } from '@/apps/manage/composables/useFunctionToggle'
import { copyToClipboard } from '@/shared/utils'

interface ManageHeaderLink {
  label: string
  value: string
  copyValue?: string
  description?: string
}

const props = defineProps<{
  title: string
  subtitle?: string
  functionType?: FunctionTypes // 如果不传，则不显示开关
  links?: ManageHeaderLink[]
  loading?: boolean
}>()

const accountInfo = useAccount()
const toggle = props.functionType != null ? useFunctionToggle(props.functionType, props.title) : null
const links = computed(() => props.links?.filter((link) => link.value) ?? [])
const switchLoading = computed(() => toggle?.loading.value ?? false)
</script>

<template>
  <div class="manage-page-header">
    <div class="manage-page-header__top">
      <div class="manage-page-header__titles">
        <div class="manage-page-header__title-row">
          <h1 class="manage-page-header__title">
            {{ title }}
          </h1>
          <div
            v-if="functionType != null && accountInfo"
            class="manage-page-header__function-toggle"
          >
            <span class="manage-kicker">功能</span>
            <UTooltip text="关闭后不会显示在个人主页">
              <USwitch
                :model-value="accountInfo.settings?.enableFunctions?.includes(functionType)"
                :loading="switchLoading"
                :disabled="loading || switchLoading"
                @update:model-value="toggle?.setEnable"
              />
            </UTooltip>
          </div>
        </div>
        <p
          v-if="subtitle"
          class="manage-page-header__subtitle"
        >
          {{ subtitle }}
        </p>
      </div>

      <div class="manage-page-header__right">
        <div class="manage-page-header__actions">
          <slot name="action" />
        </div>
      </div>
    </div>

    <div
      v-if="$slots.default"
      class="manage-page-header__below"
    >
      <slot />
    </div>

    <UCard
      v-if="links.length > 0 || $slots['links-extra']"
      class="manage-page-header__links"
      :ui="{ body: 'p-3' }"
    >
      <div class="manage-page-header__links-content">
        <div
          v-for="link in links"
          :key="`${link.label}:${link.value}`"
          class="manage-page-header__link"
        >
          <div class="manage-page-header__link-label">
            <span class="manage-kicker">{{ link.label }}</span>
            <UTooltip
              v-if="link.description"
              :text="link.description"
            >
              <UIcon name="i-lucide-info" class="manage-page-header__link-info" />
            </UTooltip>
          </div>
          <UFieldGroup class="manage-page-header__link-input">
            <UInput
              :model-value="link.value"
              readonly
              size="sm"
            />
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              @click="copyToClipboard(link.copyValue ?? link.value)"
            >
              <template #leading><UIcon name="i-lucide-copy" /></template>
              复制
            </UButton>
          </UFieldGroup>
        </div>
        <div
          v-if="$slots['links-extra']"
          class="manage-page-header__links-extra"
        >
          <slot name="links-extra" />
        </div>
      </div>
    </UCard>
  </div>
</template>

<style scoped>
.manage-page-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.manage-page-header__titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 240px;
}

.manage-page-header__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.manage-page-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0;
}

.manage-page-header__subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--vtsuru-fg-muted);
}

.manage-page-header__function-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.manage-page-header__right {
  flex: 1;
}

.manage-page-header__top,
.manage-page-header__right,
.manage-page-header__actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.manage-page-header__top {
  justify-content: space-between;
  gap: 12px;
}

.manage-page-header__right {
  justify-content: flex-end;
  align-items: center;
}

.manage-page-header__links {
  width: max-content;
  max-width: 100%;
}

.manage-page-header__links-content {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  max-width: 100%;
}

.manage-page-header__link {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 1 520px;
  width: 520px;
  max-width: 100%;
  min-width: 320px;
}

.manage-page-header__link-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.manage-page-header__link-input {
  width: 100%;
}

.manage-page-header__links-extra {
  flex: 0 0 auto;
  max-width: 100%;
}

.manage-page-header__link-info {
  cursor: help;
  color: var(--vtsuru-fg-muted);
}

@media (max-width: 480px) {
  .manage-page-header__link {
    min-width: 0;
  }
}
</style>
