<script lang="ts" setup>
import type { ComponentPublicInstance } from 'vue'
import type { UserInfo } from '@/api/api-models'
import type { OBSComponentDefinition } from '@/apps/obs-store/data/obsConstants'

import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'
import { NAlert, NButton, NCard, NGrid, NGridItem, NModal, NPageHeader, NSpace, NSpin, NTag, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { OBSComponentMap } from '@/apps/obs-store/data/obsConstants'

// --- 静态导入所有可能的组件，以便 DynamicForm 能获取到 Config 定义 ---
// 如果组件过多，考虑更动态的注册方式，但 DynamicForm 需要直接访问 Config
// 修正：直接从子组件实例获取 Config，而不是静态导入模块本身
// import * as ExampleOBSComponent from './components/ExampleOBSComponent.vue';

// --- 模拟父组件传入的信息 ---
defineProps<{
  // 如果此视图作为路由组件，可能从路由参数获取信息
  // userId?: string; // 示例：如果配置与特定用户关联
  biliInfo?: any // B站信息 (可选)
}>()

const accountInfo = useAccount()
const message = useMessage()

const userInfo = ref<UserInfo | undefined>(accountInfo.value.id ? { id: accountInfo.value.id, name: accountInfo.value.name } as UserInfo : undefined) // 模拟

const availableComponents = ref<OBSComponentDefinition[]>([])
const currentSelectedComponentId = ref<string | null>(null)
const dynamicComponentRef = ref<ComponentPublicInstance & { Config?: ConfigItemDefinition[], DefaultConfig?: any } | null>(null)

const componentConfig = ref<any>({}) // 当前选中组件的运行时配置
const componentConfigForEditing = ref<any>({}) // 模态框中编辑的配置副本

const isLoading = ref(false)
const showSettingModal = ref(false)
const refreshSignal = ref(0) // 用于手动触发子组件刷新
const showPreviewModal = ref(false) // 新增：控制预览 Modal 的显示

// 初始化可用组件列表
function initializeComponents() {
  availableComponents.value = Object.values(OBSComponentMap)
}

const currentSelectedComponent = computed<OBSComponentDefinition | undefined>(() => {
  if (!currentSelectedComponentId.value) return undefined
  return OBSComponentMap[currentSelectedComponentId.value]
})

// 用于模态框的计算属性，确保组件引用已加载并且 Config 存在
const selectedComponentDefinitionForModal = computed(() => {
  if (!currentSelectedComponent.value || !dynamicComponentRef.value?.Config) return undefined
  // 确保 dynamicComponentRef.value 存在并且具有 Config 属性
  if (dynamicComponentRef.value && typeof dynamicComponentRef.value.Config !== 'undefined') {
    return {
      ...currentSelectedComponent.value,
      componentRef: dynamicComponentRef.value, // 直接使用 ref
    }
  }
  return undefined
})

async function selectComponent(componentId: string) {
  if (currentSelectedComponentId.value === componentId) { // 如果已经是当前选中的，则尝试刷新
    refreshSelectedComponent()
    return
  }

  currentSelectedComponentId.value = componentId
  isLoading.value = true
  componentConfig.value = {} // 重置配置

  // 等待下一个 tick 确保 dynamicComponentRef 更新
  await new Promise(resolve => setTimeout(resolve, 0))
  currentSelectedComponent.value!.settingName = dynamicComponentRef.value?.Config ? `OBSStore.Config.${currentSelectedComponent.value!.id}` : undefined

  if (currentSelectedComponent.value?.settingName) {
    await loadComponentConfig(currentSelectedComponent.value.settingName)
  } else {
    // 如果组件没有 settingName，则它可能不使用持久化配置，或者使用默认配置
    if (dynamicComponentRef.value && dynamicComponentRef.value.DefaultConfig) {
      componentConfig.value = { ...dynamicComponentRef.value.DefaultConfig }
      componentConfigForEditing.value = JSON.parse(JSON.stringify(componentConfig.value))
    }
  }
  isLoading.value = false
  showPreviewModal.value = true // 新增：显示预览 Modal
}

async function loadComponentConfig(settingName: string) {
  if (!userInfo.value?.id) {
    message.error('无法加载组件配置：未找到用户信息。')
    if (dynamicComponentRef.value && dynamicComponentRef.value.DefaultConfig) {
      componentConfig.value = { ...dynamicComponentRef.value.DefaultConfig }
      componentConfigForEditing.value = JSON.parse(JSON.stringify(componentConfig.value))
    }
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    const configData = await DownloadConfig<any>(settingName, userInfo.value.id)
    const defaultConfig = dynamicComponentRef.value?.DefaultConfig || {}

    if (configData.msg || Object.keys(configData.data || {}).length === 0) {
      componentConfig.value = { ...defaultConfig }
      message.info('未找到在线配置，已加载默认配置。')
    } else {
      // 合并远程配置和默认配置，确保所有键都存在
      componentConfig.value = configData.data
    }
  } catch (error) {
    console.error('加载组件配置失败:', error)
    message.error(`加载组件配置失败: ${error instanceof Error ? error.message : String(error)}`)
    componentConfig.value = { ...(dynamicComponentRef.value?.DefaultConfig || {}) }
  } finally {
    componentConfigForEditing.value = JSON.parse(JSON.stringify(componentConfig.value)) // 深拷贝用于编辑
    isLoading.value = false
  }
}

async function saveComponentConfig() {
  if (!currentSelectedComponent.value?.settingName || !userInfo.value?.id) {
    message.error('无法保存配置：组件配置名称或用户信息丢失。')
    return
  }
  isLoading.value = true
  try {
    await UploadConfig(currentSelectedComponent.value.settingName, JSON.stringify(componentConfigForEditing.value), // 保存编辑后的配置
      false) // 或根据需要设置为 true);
    message.success('配置保存成功！')
    componentConfig.value = JSON.parse(JSON.stringify(componentConfigForEditing.value)) // 更新运行时配置
    showSettingModal.value = false
    refreshSignal.value++ // 触发子组件刷新
  } catch (error) {
    console.error('保存组件配置失败:', error)
    message.error(`保存组件配置失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isLoading.value = false
  }
}

function onDynamicFormUpdate(updatedConfig: any) {
  componentConfigForEditing.value = updatedConfig
}

function handleConfigUpdateFromChild(newConfig: any) {
  componentConfig.value = newConfig
  componentConfigForEditing.value = JSON.parse(JSON.stringify(newConfig))
}

function refreshSelectedComponent() {
  if (!currentSelectedComponent.value) return
  message.info(`正在刷新 ${currentSelectedComponent.value.name}...`)

  // 方式1: 增加 refreshSignal 以触发子组件 watch
  refreshSignal.value++

  // 方式2: 如果子组件有暴露的刷新方法，可以调用
  // if (typeof dynamicComponentRef.value?.refresh === 'function') {
  //   dynamicComponentRef.value.refresh();
  // }

  // 可选: 重新加载配置
  if (currentSelectedComponent.value.settingName) {
    loadComponentConfig(currentSelectedComponent.value.settingName)
  }
}

// 当 dynamicComponentRef 变化时 (组件加载完成)，尝试加载/设置配置
watch(dynamicComponentRef, (newRef) => {
  if (newRef) { // 组件已挂载
    const compDef = currentSelectedComponent.value
    if (compDef) {
      currentSelectedComponent.value!.settingName = newRef.Config ? `OBSStore.Config.${currentSelectedComponent.value!.id}` : undefined
      if (compDef.settingName) {
        // 如果有 settingName，则 loadComponentConfig 会处理（包括默认配置）
        // 这里确保在 selectComponent 中已经调用了 loadComponentConfig
      } else if (newRef.DefaultConfig) {
        // 没有 settingName，但子组件有 DefaultConfig
        componentConfig.value = { ...newRef.DefaultConfig }
        componentConfigForEditing.value = JSON.parse(JSON.stringify(componentConfig.value))
      }
    }
  }
}, { immediate: false }) // immediate: false 因为 selectComponent 会处理首次加载

watch(showSettingModal, (isShown) => {
  if (isShown && currentSelectedComponent.value) {
    // 打开模态框时，确保编辑的是当前运行时配置的深拷贝
    // 同时，确保 DefaultConfig 能够正确合并，以防远程配置不完整
    const defaultConfig = dynamicComponentRef.value?.DefaultConfig || {}
    componentConfigForEditing.value = JSON.parse(JSON.stringify({
      ...defaultConfig,
      ...componentConfig.value, // 当前运行时配置优先
    }))
  }
})

// 新增：用于从预览 Modal 中打开配置 Modal
function openSettingsForCurrentComponent() {
  if (currentSelectedComponent.value?.settingName && userInfo.value?.id === accountInfo.value.id) {
    // 确保 componentConfigForEditing 是最新的，基于 componentConfig
    // watch(showSettingModal) 已经处理了更复杂的默认配置合并逻辑，这里仅确保基于当前运行时配置的深拷贝
    const defaultConfig = dynamicComponentRef.value?.DefaultConfig || {}
    componentConfigForEditing.value = JSON.parse(JSON.stringify({
      ...defaultConfig,
      ...componentConfig.value,
    }))
    showSettingModal.value = true
  } else {
    message.error('无法打开配置：组件无设置项或用户不匹配。')
  }
}

function handlePreviewModalUpdateShow(show: boolean) {
  showPreviewModal.value = show // 保持 v-model:show 的双向绑定
  if (!show) {
    // 清理预览 Modal 关闭后的状态
    currentSelectedComponentId.value = null
    componentConfig.value = {}
    componentConfigForEditing.value = {}
    dynamicComponentRef.value = null // 清除对组件实例的引用
  }
}

onMounted(() => {
  initializeComponents()
  // 可以在这里根据路由参数或其他逻辑自动选择一个组件
  // if (props.initialComponentId) {
  //   selectComponent(props.initialComponentId);
  // }
})
</script>

<template>
  <div class="obs-component-store-view">
    <NPageHeader :title="currentSelectedComponent ? currentSelectedComponent.name : 'OBS 组件商店'">
      <template #subtitle>
        {{ currentSelectedComponent ? currentSelectedComponent.description : '选择一个组件进行预览和配置' }}
      </template>
    </NPageHeader>

    <NGrid
      cols="1 s:2 m:3 l:4 xl:4 xxl:5"
      responsive="screen"
      :x-gap="12"
      :y-gap="12"
      style="padding: 16px;"
    >
      <NGridItem
        v-for="compDef in availableComponents"
        :key="compDef.id"
      >
        <NCard
          :title="compDef.name"
          hoverable
          class="component-card"
          @click="selectComponent(compDef.id)"
        >
          <template
            v-if="compDef.icon"
            #cover
          >
            <!-- <img :src="compDef.icon" alt="compDef.name" /> -->
          </template>
          <p>{{ compDef.description }}</p>
          <template
            v-if="compDef.version"
            #footer
          >
            <NTag
              size="small"
              type="info"
            >
              v{{ compDef.version }}
            </NTag>
          </template>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 组件预览 Modal -->
    <NModal
      v-model:show="showPreviewModal"
      preset="card"
      :title="`组件预览：${currentSelectedComponent?.name || ''}`"
      style="max-width: 95vw; width: 1000px; max-height: 95vh; height: 1000px;"
      @update:show="handlePreviewModalUpdateShow"
    >
      <template #header-extra>
        <NSpace>
          <NButton
            v-if="dynamicComponentRef?.Config"
            type="primary"
            size="small"
            @click="openSettingsForCurrentComponent"
          >
            配置组件
          </NButton>
          <NButton
            v-if="currentSelectedComponent"
            size="small"
            @click="refreshSelectedComponent"
          >
            刷新组件
          </NButton>
        </NSpace>
      </template>
      <div class="component-preview-area">
        <NAlert
          v-if="isLoading"
          title="加载中..."
          type="info"
          style="margin-bottom: 16px;"
        >
          正在加载组件配置和资源...
        </NAlert>
        <NSpin :show="isLoading">
          <NFlex vertical>
            <NFlex>
              <NButton style="display: none;">
                占位
              </NButton>
            </NFlex>
            <component
              :is="currentSelectedComponent!.component"
              v-if="currentSelectedComponent"
              ref="dynamicComponentRef"
              :config="componentConfig"
              :user-info="userInfo"
              :bili-info="biliInfo"
              :refresh-signal="refreshSignal"
              v-bind="currentSelectedComponent.props || {}"
              @update:config="handleConfigUpdateFromChild"
            />
          </NFlex>
        </NSpin>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showPreviewModal = false">
            关闭
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 组件配置 Modal -->
    <NModal
      v-model:show="showSettingModal"
      style="max-width: 90vw; width: 800px;"
      preset="card"
      title="组件配置"
      :mask-closable="false"
    >
      <DynamicForm
        v-if="selectedComponentDefinitionForModal?.settingName && selectedComponentDefinitionForModal?.componentRef?.Config"
        :name="selectedComponentDefinitionForModal.settingName"
        :config-data="componentConfigForEditing"
        :config="selectedComponentDefinitionForModal.componentRef.Config"
        @update:config-data="onDynamicFormUpdate"
      />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showSettingModal = false">
            取消
          </NButton>
          <NButton
            type="primary"
            @click="saveComponentConfig"
          >
            保存配置
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
  .obs-component-store-view {
    padding: 0px;
    /* 改为0，由 PageHeader 控制内边距 */
  }

  .component-card {
    cursor: pointer;
    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  }

  .component-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--n-box-shadow-active);
  }

  .component-card p {
    min-height: 40px;
    /* 防止描述为空时卡片高度不一致 */
    font-size: 0.9em;
    color: var(--n-text-color-disabled);
  }

  .component-preview-area {
    min-height: 300px; /* 预览区域最小高度 */
    /* padding: 16px; /* 由 NModal card preset 提供内边距 */
    /* margin-top: 16px; /* NModal 会处理间距 */
    /* border: 1px solid var(--n-border-color); /* NModal card preset 提供边框 */
    /* border-radius: var(--n-border-radius); /* NModal card preset 提供圆角 */
    /* background-color: var(--n-card-color); /* NModal card preset 提供背景 */
  }
</style>
