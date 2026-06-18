<script setup lang="ts">
import type { FunctionTypes } from '@/api/api-models'
import { Copy24Filled, Info24Filled } from '@vicons/fluent'
import { useAccount } from '@/api/account'
import { NButton, NCard, NFlex, NIcon, NInput, NInputGroup, NSwitch, NText, NTooltip } from 'naive-ui'
import { computed } from 'vue'
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
const links = computed(() => props.links?.filter(link => link.value) ?? [])
const switchLoading = computed(() => toggle?.loading.value ?? false)
</script>

<template>
  <div class="manage-page-header">
    <NFlex class="manage-page-header__top" justify="space-between" align="flex-start" wrap :size="12">
      <div class="manage-page-header__titles">
        <div class="manage-page-header__title-row">
          <h1 class="manage-page-header__title">
            {{ title }}
          </h1>
          <NFlex v-if="functionType != null && accountInfo" class="manage-page-header__function-toggle" align="center" :size="8">
            <NText depth="3" class="manage-kicker">
              功能
            </NText>
            <NTooltip>
              <template #trigger>
                <NSwitch
                  :value="accountInfo.settings?.enableFunctions?.includes(functionType)"
                  :loading="switchLoading"
                  :disabled="loading || switchLoading"
                  @update:value="toggle?.setEnable"
                >
                  <template #checked>
                    已启用
                  </template>
                  <template #unchecked>
                    已禁用
                  </template>
                </NSwitch>
              </template>
              关闭后不会显示在个人主页
            </NTooltip>
          </NFlex>
        </div>
        <NText v-if="subtitle" depth="3" class="manage-page-header__subtitle">
          {{ subtitle }}
        </NText>
      </div>

      <NFlex class="manage-page-header__right" align="center" justify="end" wrap :size="10">
        <NFlex class="manage-page-header__actions" :wrap="true">
          <slot name="action" />
        </NFlex>
      </NFlex>
    </NFlex>

    <div v-if="$slots.default" class="manage-page-header__below">
      <slot />
    </div>

    <NCard
      v-if="links.length > 0 || $slots['links-extra']"
      class="manage-page-header__links"
      size="small"
      :bordered="true"
      content-style="padding: 12px;"
    >
      <NFlex class="manage-page-header__links-content" align="flex-end" wrap :size="12">
        <NFlex
          v-for="link in links"
          :key="`${link.label}:${link.value}`"
          class="manage-page-header__link"
          vertical
          :size="8"
        >
          <NFlex align="center" :size="4">
            <NText class="manage-kicker">
              {{ link.label }}
            </NText>
            <NTooltip v-if="link.description">
              <template #trigger>
                <NIcon :component="Info24Filled" class="manage-page-header__link-info" />
              </template>
              {{ link.description }}
            </NTooltip>
          </NFlex>
          <NInputGroup class="manage-page-header__link-input">
            <NInput :value="link.value" readonly size="small" />
            <NButton secondary size="small" @click="copyToClipboard(link.copyValue ?? link.value)">
              <template #icon>
                <NIcon :component="Copy24Filled" />
              </template>
              复制
            </NButton>
          </NInputGroup>
        </NFlex>
        <div v-if="$slots['links-extra']" class="manage-page-header__links-extra">
          <slot name="links-extra" />
        </div>
      </NFlex>
    </NCard>
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
  font-size: 13px;
  line-height: 1.4;
}

.manage-page-header__function-toggle {
  min-height: 28px;
}

.manage-page-header__right {
  flex: 1;
}

.manage-page-header__actions :deep(.n-button) {
  margin-left: 0;
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
  flex: 0 1 520px;
  width: 520px;
  max-width: 100%;
  min-width: 320px;
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
