<script setup lang="ts">
import {
  Dismiss24Regular,
  Open24Regular,
} from '@vicons/fluent'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NFlex,
  NIcon,
  NSpin,
  NTag,
  NText,
} from 'naive-ui'
import {
  computed,
  defineAsyncComponent,
  ref,
  shallowRef,
  watch,
} from 'vue'

import type { ObsComponentDefinition } from '@/apps/obs-store/registry'

const props = defineProps<{
  show: boolean
  component: ObsComponentDefinition | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const activeComponentLoader = shallowRef<any>(null)
const isLoading = ref(false)

watch(
  () => props.component,
  async (comp) => {
    if (!comp || !comp.manageComponent) {
      activeComponentLoader.value = null
      return
    }

    try {
      isLoading.value = true
      activeComponentLoader.value = defineAsyncComponent(comp.manageComponent)
    } catch {
      activeComponentLoader.value = null
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)

const isReady = computed(() => props.component?.status === 'ready')

function handleClose() {
  emit('update:show', false)
}
</script>

<template>
  <NDrawer
    :show="props.show"
    :width="960"
    placement="right"
    :mask-closable="true"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent
      closable
      :native-scrollbar="false"
      class="obs-drawer-content"
    >
      <template #header>
        <NFlex
          v-if="props.component"
          justify="space-between"
          align="center"
          class="w-full"
        >
          <div class="drawer-header-left">
            <div class="icon-wrap">
              <NIcon
                :component="props.component.icon"
                class="header-icon"
              />
            </div>
            <div>
              <NFlex
                align="center"
                :size="8"
              >
                <span class="header-title">{{ props.component.name }}</span>
                <NTag
                  size="tiny"
                  :type="isReady ? 'success' : 'default'"
                  :bordered="false"
                >
                  {{ isReady ? '已就绪' : '规划中' }}
                </NTag>
              </NFlex>
              <NText
                depth="3"
                class="header-desc"
              >
                {{ props.component.shortDescription }}
              </NText>
            </div>
          </div>

          <NFlex
            v-if="props.component?.managePath"
            align="center"
            :size="8"
          >
            <NButton
              size="small"
              secondary
              tag="a"
              :href="props.component.managePath"
              target="_blank"
            >
              <template #icon>
                <NIcon :component="Open24Regular" />
              </template>
              独立窗口打开
            </NButton>
          </NFlex>
        </NFlex>
      </template>

      <!-- 抽屉主体区域 -->
      <div
        v-if="props.component"
        class="drawer-body-inner"
      >
        <NSpin :show="isLoading">
          <component
            :is="activeComponentLoader"
            v-if="activeComponentLoader"
          />
          <div
            v-else-if="!isLoading"
            class="placeholder-wrap"
          >
            <NText depth="3">
              该组件尚在开发规划中，暂无可用的配置控制台。
            </NText>
          </div>
        </NSpin>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--vtsuru-brand-soft);
  color: var(--vtsuru-brand);
  border-radius: 8px;
  flex-shrink: 0;
}

.header-icon {
  font-size: 20px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.header-desc {
  font-size: 12px;
  display: block;
  margin-top: 2px;
}

.drawer-body-inner {
  padding: 4px 0 24px;
}

.placeholder-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}
</style>
