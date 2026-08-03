<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, ref } from 'vue'

import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import type { UserInfo } from '@/api/api-models'
import type { OBSComponentDefinition } from '@/apps/obs-store/data/obsConstants'
import { OBSComponentMap } from '@/apps/obs-store/data/obsConstants'
import { showErrorToast, showInfoToast, showSuccessToast } from '@/shared/services/toast'
import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'

defineProps<{
  biliInfo?: unknown
}>()

interface ConfigurableComponent extends ComponentPublicInstance {
  Config?: ConfigItemDefinition[]
  DefaultConfig?: Record<string, unknown>
}

const account = useAccount()
const components = Object.values(OBSComponentMap)
const selectedId = ref<string>()
const componentRef = ref<ConfigurableComponent>()
const componentConfig = ref<Record<string, unknown>>({})
const editingConfig = ref<Record<string, unknown>>({})
const loading = ref(false)
const previewOpen = ref(false)
const settingsOpen = ref(false)
const refreshSignal = ref(0)

const userInfo = computed<UserInfo | undefined>(() =>
  account.value.id ? ({ id: account.value.id, name: account.value.name } as UserInfo) : undefined,
)
const selected = computed<OBSComponentDefinition | undefined>(() =>
  selectedId.value ? OBSComponentMap[selectedId.value] : undefined,
)
const settingName = computed(() =>
  selected.value && componentRef.value?.Config ? `OBSStore.Config.${selected.value.id}` : undefined,
)

function cloneConfig(config: Record<string, unknown>) {
  return structuredClone(config)
}

function applyConfig(config: Record<string, unknown>) {
  componentConfig.value = config
  editingConfig.value = cloneConfig(config)
}

async function loadConfig() {
  const defaults = componentRef.value?.DefaultConfig ?? {}
  if (!settingName.value) {
    applyConfig(cloneConfig(defaults))
    return
  }
  if (!userInfo.value?.id) throw new Error('未找到当前用户信息')

  const response = await DownloadConfig<Record<string, unknown>>(settingName.value, userInfo.value.id)
  if (response.msg || !Object.keys(response.data ?? {}).length) {
    applyConfig(cloneConfig(defaults))
    showInfoToast('未找到在线配置，已加载默认配置')
    return
  }
  applyConfig({ ...defaults, ...response.data })
}

async function selectComponent(componentId: string) {
  selectedId.value = componentId
  previewOpen.value = true
  loading.value = true
  componentConfig.value = {}
  componentRef.value = undefined

  try {
    await nextTick()
    await loadConfig()
  } catch (error) {
    showErrorToast(`加载组件配置失败：${error instanceof Error ? error.message : String(error)}`)
    applyConfig(cloneConfig(componentRef.value?.DefaultConfig ?? {}))
  } finally {
    loading.value = false
  }
}

async function refreshComponent() {
  if (!selected.value) return
  loading.value = true
  try {
    await loadConfig()
    refreshSignal.value++
    showInfoToast(`已刷新 ${selected.value.name}`)
  } catch (error) {
    showErrorToast(`刷新组件失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    loading.value = false
  }
}

function openSettings() {
  editingConfig.value = cloneConfig({
    ...(componentRef.value?.DefaultConfig ?? {}),
    ...componentConfig.value,
  })
  settingsOpen.value = true
}

async function saveConfig() {
  if (!settingName.value || !userInfo.value?.id) {
    showErrorToast('当前组件没有可保存的配置')
    return
  }

  loading.value = true
  try {
    await UploadConfig(settingName.value, JSON.stringify(editingConfig.value), false)
    applyConfig(cloneConfig(editingConfig.value))
    refreshSignal.value++
    settingsOpen.value = false
    showSuccessToast('配置保存成功')
  } catch (error) {
    showErrorToast(`保存组件配置失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    loading.value = false
  }
}

function closePreview() {
  previewOpen.value = false
  selectedId.value = undefined
  componentRef.value = undefined
  componentConfig.value = {}
  editingConfig.value = {}
}
</script>

<template>
  <main class="obs-store">
    <header class="store-header">
      <p class="store-eyebrow">OBS COMPONENTS</p>
      <h1>OBS 组件商店</h1>
      <p>选择组件进行实时预览，并为当前账户保存配置。</p>
    </header>

    <div class="component-grid">
      <button
        v-for="component in components"
        :key="component.id"
        class="component-card"
        type="button"
        @click="selectComponent(component.id)"
      >
        <span class="component-icon">
          <UIcon name="i-lucide-panels-top-left" />
        </span>
        <span class="component-copy">
          <strong>{{ component.name }}</strong>
          <small>{{ component.description }}</small>
        </span>
        <UBadge
          v-if="component.version"
          color="neutral"
          variant="soft"
          size="sm"
        >
          v{{ component.version }}
        </UBadge>
      </button>
    </div>

    <UModal
      v-model:open="previewOpen"
      :title="`组件预览：${selected?.name ?? ''}`"
      :ui="{ content: 'sm:max-w-5xl' }"
      @update:open="(open) => !open && closePreview()"
    >
      <template #body>
        <div class="preview-actions">
          <UButton
            v-if="componentRef?.Config"
            icon="i-lucide-settings-2"
            @click="openSettings"
          >
            配置组件
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            @click="refreshComponent"
          >
            刷新组件
          </UButton>
        </div>

        <UAlert
          v-if="loading"
          color="info"
          icon="i-lucide-loader-circle"
          title="正在加载组件配置和资源"
        />

        <div class="component-preview">
          <component
            :is="selected.component"
            v-if="selected"
            ref="componentRef"
            :config="componentConfig"
            :user-info="userInfo"
            :bili-info="biliInfo"
            :refresh-signal="refreshSignal"
            v-bind="selected.props ?? {}"
            @update:config="applyConfig"
          />
        </div>
      </template>
      <template #footer>
        <div class="modal-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="closePreview"
          >
            关闭
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="settingsOpen"
      title="组件配置"
      :dismissible="false"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <DynamicForm
          v-if="settingName && componentRef?.Config"
          :name="settingName"
          :config-data="editingConfig"
          :config="componentRef.Config"
          @update:config-data="editingConfig = $event"
        />
      </template>
      <template #footer>
        <div class="modal-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="settingsOpen = false"
          >
            取消
          </UButton>
          <UButton
            :loading="loading"
            @click="saveConfig"
          >
            保存配置
          </UButton>
        </div>
      </template>
    </UModal>
  </main>
</template>

<style scoped>
.obs-store {
  display: grid;
  gap: 24px;
  padding: 20px;
}

.store-header h1,
.store-header p {
  margin: 0;
}

.store-header h1 {
  margin-block: 4px 8px;
  font-size: clamp(26px, 4vw, 36px);
}

.store-header > p:last-child,
.component-copy small {
  color: var(--vtsuru-fg-muted);
}

.store-eyebrow {
  color: var(--vtsuru-brand);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.component-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 12px;
  padding: 16px;
  color: var(--vtsuru-fg);
  text-align: left;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  cursor: pointer;
  transition:
    border-color 150ms ease,
    transform 150ms ease;
}

.component-card:hover {
  border-color: var(--vtsuru-brand);
  transform: translateY(-1px);
}

.component-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--vtsuru-brand);
  background: var(--vtsuru-brand-soft);
  border-radius: var(--vtsuru-radius);
}

.component-copy {
  display: grid;
  gap: 4px;
}

.component-copy small {
  line-height: 1.5;
}

.preview-actions,
.modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.component-preview {
  min-height: 300px;
  margin-top: 16px;
}
</style>
