<template>
  <div class="obs-component-store-view">
    <NPageHeader :title="currentSelectedComponent ? currentSelectedComponent.name : 'OBS 组件商店'">
      <template #subtitle>
        {{ currentSelectedComponent ? currentSelectedComponent.description : '选择一个组件进行预览和配置' }}
      </template>
      <template #extra>
        <NSpace>
          <NButton
            v-if="currentSelectedComponent?.settingName && userInfo?.id === accountInfo.id"
            type="primary"
            @click="showSettingModal = true"
          >
            配置组件
          </NButton>
          <NButton
            v-if="currentSelectedComponent"
            @click="refreshSelectedComponent"
          >
            刷新组件
          </NButton>
        </NSpace>
      </template>
    </NPageHeader>

    <NGrid
      v-if="!currentSelectedComponent"
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

    <div
      v-if="currentSelectedComponent"
      class="component-preview-area"
    >
      <NAlert
        v-if="isLoading"
        title="加载中..."
        type="info"
        style="margin-bottom: 16px;"
      >
        正在加载组件配置和资源...
      </NAlert>
      <NSpin :show="isLoading">
        <component
          :is="currentSelectedComponent.component"
          ref="dynamicComponentRef"
          :config="componentConfig"
          :user-info="userInfo"
          :bili-info="biliInfo"
          :refresh-signal="refreshSignal"
          v-bind="currentSelectedComponent.props || {}"
          @update:config="handleConfigUpdateFromChild"
        />
      </NSpin>
    </div>

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

<script lang="ts" setup>
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account';
import { UserInfo } from '@/api/api-models';
import { OBSComponentMap } from '@/data/obsConstants';
import { OBSComponentDefinition } from '@/data/obsConstants';
import { ConfigItemDefinition } from '@/data/VTsuruConfigTypes';
import { useBiliAuth } from '@/store/useBiliAuth';
import { NAlert, NButton, NCard, NGrid, NGridItem, NModal, NPageHeader, NSpace, NSpin, NTag, useMessage } from 'naive-ui';
import { ComponentPublicInstance, computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';

// --- 静态导入所有可能的组件，以便 DynamicForm 能获取到 Config 定义 ---
// 如果组件过多，考虑更动态的注册方式，但 DynamicForm 需要直接访问 Config
// 修正：直接从子组件实例获取 Config，而不是静态导入模块本身
// import * as ExampleOBSComponent from './components/ExampleOBSComponent.vue';


// --- 模拟父组件传入的信息 ---
const props = defineProps<{
  // 如果此视图作为路由组件，可能从路由参数获取信息
  // userId?: string; // 示例：如果配置与特定用户关联
  biliInfo?: any; // B站信息 (可选)
}>();

const accountInfo = useAccount();
const biliAuth = useBiliAuth(); // 若需要B站授权信息
const message = useMessage();

const userInfo = ref<UserInfo | undefined>(accountInfo.value.id ? { id: accountInfo.value.id, name: accountInfo.value.username } as UserInfo : undefined); // 模拟

const availableComponents = ref<OBSComponentDefinition[]>([]);
const currentSelectedComponentId = ref<string | null>(null);
const dynamicComponentRef = ref<ComponentPublicInstance & { Config?: ConfigItemDefinition[], DefaultConfig?: any } | null>(null);


const componentConfig = ref<any>({}); // 当前选中组件的运行时配置
const componentConfigForEditing = ref<any>({}); // 模态框中编辑的配置副本

const isLoading = ref(false);
const showSettingModal = ref(false);
const refreshSignal = ref(0); // 用于手动触发子组件刷新

// 初始化可用组件列表
function initializeComponents() {
  // 清空并重新从 OBSComponentMap 构建，避免重复添加
  availableComponents.value = [];
  // 示例组件定义（实际项目中可能从 obsConstants.ts 导入并处理）
  if (!OBSComponentMap['example']) {
    const exampleCompDef: OBSComponentDefinition = {
      id: 'example',
      name: '示例 OBS 组件',
      description: '这是一个基础的OBS组件，用于演示和测试功能。',
      component: defineAsyncComponent(() => import('./components/ExampleOBSComponent.vue')),
      settingName: 'obsExampleComponentSettings', // 用于配置存储的键
      version: '1.0.0',
      // icon: 'path/to/icon.png'
    };
    OBSComponentMap['example'] = exampleCompDef;
  }
  availableComponents.value = Object.values(OBSComponentMap);
}

const currentSelectedComponent = computed<OBSComponentDefinition | undefined>(() => {
  if (!currentSelectedComponentId.value) return undefined;
  return OBSComponentMap[currentSelectedComponentId.value];
});

// 用于模态框的计算属性，确保组件引用已加载并且 Config 存在
const selectedComponentDefinitionForModal = computed(() => {
  if (!currentSelectedComponent.value || !dynamicComponentRef.value?.Config) return undefined;
  return {
    ...currentSelectedComponent.value,
    componentRef: dynamicComponentRef.value, // 直接使用 ref
  };
});


async function selectComponent(componentId: string) {
  if (currentSelectedComponentId.value === componentId) { // 如果已经是当前选中的，则尝试刷新
    refreshSelectedComponent();
    return;
  }

  currentSelectedComponentId.value = componentId;
  isLoading.value = true;
  componentConfig.value = {}; // 重置配置

  // 等待下一个 tick 确保 dynamicComponentRef 更新
  await new Promise(resolve => setTimeout(resolve, 0));

  if (currentSelectedComponent.value?.settingName) {
    await loadComponentConfig(currentSelectedComponent.value.settingName);
  } else {
    // 如果组件没有 settingName，则它可能不使用持久化配置，或者使用默认配置
    if (dynamicComponentRef.value && dynamicComponentRef.value.DefaultConfig) {
      componentConfig.value = { ...dynamicComponentRef.value.DefaultConfig };
      componentConfigForEditing.value = JSON.parse(JSON.stringify(componentConfig.value));
    }
  }
  isLoading.value = false;
}

async function loadComponentConfig(settingName: string) {
  if (!userInfo.value?.id) {
    message.error('无法加载组件配置：未找到用户信息。');
    if (dynamicComponentRef.value && dynamicComponentRef.value.DefaultConfig) {
      componentConfig.value = { ...dynamicComponentRef.value.DefaultConfig };
      componentConfigForEditing.value = JSON.parse(JSON.stringify(componentConfig.value));
    }
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  try {
    const configData = await DownloadConfig(settingName, userInfo.value.id);
    const defaultConfig = dynamicComponentRef.value?.DefaultConfig || {};

    if (configData.msg || Object.keys(configData.data || {}).length === 0) {
      componentConfig.value = { ...defaultConfig };
      message.info('未找到在线配置，已加载默认配置。');
    } else {
      // 合并远程配置和默认配置，确保所有键都存在
      componentConfig.value = { ...defaultConfig, ...configData.data };
    }
  } catch (error) {
    console.error('加载组件配置失败:', error);
    message.error(`加载组件配置失败: ${error instanceof Error ? error.message : String(error)}`);
    componentConfig.value = { ...(dynamicComponentRef.value?.DefaultConfig || {}) };
  } finally {
    componentConfigForEditing.value = JSON.parse(JSON.stringify(componentConfig.value)); // 深拷贝用于编辑
    isLoading.value = false;
  }
}

async function saveComponentConfig() {
  if (!currentSelectedComponent.value?.settingName || !userInfo.value?.id) {
    message.error('无法保存配置：组件配置名称或用户信息丢失。');
    return;
  }
  isLoading.value = true;
  try {
    await UploadConfig({
      name: currentSelectedComponent.value.settingName,
      config: JSON.stringify(componentConfigForEditing.value), // 保存编辑后的配置
      isPublic: false, // 或根据需要设置为 true
    });
    message.success('配置保存成功！');
    componentConfig.value = JSON.parse(JSON.stringify(componentConfigForEditing.value)); // 更新运行时配置
    showSettingModal.value = false;
    refreshSignal.value++; // 触发子组件刷新
  } catch (error) {
    console.error('保存组件配置失败:', error);
    message.error(`保存组件配置失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isLoading.value = false;
  }
}

function onDynamicFormUpdate(updatedConfig: any) {
  componentConfigForEditing.value = updatedConfig;
}

function handleConfigUpdateFromChild(newConfig: any) {
  // 如果子组件能直接修改配置并冒泡事件，可以在此处理
  // componentConfig.value = newConfig;
  // componentConfigForEditing.value = JSON.parse(JSON.stringify(newConfig));
  // console.log('Config updated from child:', newConfig);
}

function refreshSelectedComponent() {
  if (!currentSelectedComponent.value) return;
  message.info(`正在刷新 ${currentSelectedComponent.value.name}...`);

  // 方式1: 增加 refreshSignal 以触发子组件 watch
  refreshSignal.value++;

  // 方式2: 如果子组件有暴露的刷新方法，可以调用
  // if (typeof dynamicComponentRef.value?.refresh === 'function') {
  //   dynamicComponentRef.value.refresh();
  // }

  // 可选: 重新加载配置
  if (currentSelectedComponent.value.settingName) {
     loadComponentConfig(currentSelectedComponent.value.settingName);
  }
}

// 当 dynamicComponentRef 变化时 (组件加载完成)，尝试加载/设置配置
watch(dynamicComponentRef, (newRef) => {
  if (newRef) { // 组件已挂载
    const compDef = currentSelectedComponent.value;
    if (compDef) {
      if (compDef.settingName) {
        // 如果有 settingName，则 loadComponentConfig 会处理（包括默认配置）
        // 这里确保在 selectComponent 中已经调用了 loadComponentConfig
      } else if (newRef.DefaultConfig) {
        // 没有 settingName，但子组件有 DefaultConfig
        componentConfig.value = { ...newRef.DefaultConfig };
        componentConfigForEditing.value = JSON.parse(JSON.stringify(componentConfig.value));
      }
    }
  }
}, { immediate: false }); // immediate: false 因为 selectComponent 会处理首次加载

watch(showSettingModal, (isShown) => {
  if (isShown && currentSelectedComponent.value) {
    // 打开模态框时，确保编辑的是当前运行时配置的深拷贝
    // 同时，确保 DefaultConfig 能够正确合并，以防远程配置不完整
    const defaultConfig = dynamicComponentRef.value?.DefaultConfig || {};
    componentConfigForEditing.value = JSON.parse(JSON.stringify({
      ...defaultConfig,
      ...componentConfig.value // 当前运行时配置优先
    }));
  }
});

onMounted(() => {
  initializeComponents();
  // 可以在这里根据路由参数或其他逻辑自动选择一个组件
  // if (props.initialComponentId) {
  //   selectComponent(props.initialComponentId);
  // }
});

</script>

<style scoped>
.obs-component-store-view {
  padding: 0px; /* 改为0，由 PageHeader 控制内边距 */
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
  min-height: 40px; /* 防止描述为空时卡片高度不一致 */
  font-size: 0.9em;
  color: var(--n-text-color-disabled);
}

.component-preview-area {
  padding: 16px;
  margin-top: 16px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  background-color: var(--n-card-color);
  min-height: 300px; /* 预览区域最小高度 */
}
</style>