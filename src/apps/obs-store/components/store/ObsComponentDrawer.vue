<script setup lang="ts">
import { Open24Regular } from '@vicons/fluent'
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue'

import type { ObsComponentDefinition } from '@/apps/obs-store/registry'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Sheet, SheetContent, SheetHeader } from '@/shared/ui/sheet'
import { Spin } from '@/shared/ui/spin'

const props = defineProps<{
  show: boolean
  component: ObsComponentDefinition | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const activeComponentLoader = shallowRef<ReturnType<typeof defineAsyncComponent> | null>(null)
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
      activeComponentLoader.value = defineAsyncComponent({
        loader: comp.manageComponent,
        delay: 120,
        timeout: 20_000,
        onError(error, retry, fail, attempts) {
          if (attempts <= 2) retry()
          else fail()
        },
      })
    } catch {
      activeComponentLoader.value = null
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)

const isReady = computed(() => props.component?.status === 'ready')
const statusLabel = computed(() => (props.component?.status === 'beta' ? '内测' : isReady.value ? '已就绪' : '规划中'))
</script>

<template>
  <Sheet
    :open="props.show"
    @update:open="emit('update:show', $event)"
  >
    <SheetContent
      side="right"
      class="w-full sm:max-w-[960px] p-6 overflow-y-auto"
    >
      <SheetHeader
        v-if="props.component"
        class="border-b pb-4 mb-4"
      >
        <div class="flex items-center justify-between gap-4 w-full pr-6">
          <div class="drawer-header-left">
            <div class="icon-wrap">
              <component
                :is="props.component.icon"
                class="size-5"
              />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="header-title">{{ props.component.name }}</span>
                <Badge
                  variant="outline"
                  :class="[
                    'text-[10px] h-4.5 px-1.5',
                    props.component?.status === 'beta'
                      ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                      : isReady
                        ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'text-muted-foreground',
                  ]"
                >
                  {{ statusLabel }}
                </Badge>
              </div>
              <div class="header-desc text-muted-foreground">
                {{ props.component.shortDescription }}
              </div>
            </div>
          </div>

          <div
            v-if="props.component?.managePath"
            class="flex items-center gap-2"
          >
            <Button
              variant="secondary"
              class="gap-1.5"
              as-child
            >
              <a
                :href="props.component.managePath"
                target="_blank"
              >
                <Open24Regular class="size-4" />
                独立窗口打开
              </a>
            </Button>
          </div>
        </div>
      </SheetHeader>

      <!-- 抽屉主体区域 -->
      <div
        v-if="props.component"
        class="drawer-body-inner"
      >
        <Spin :show="isLoading">
          <component
            :is="activeComponentLoader"
            v-if="activeComponentLoader"
          />
          <div
            v-else-if="!isLoading"
            class="placeholder-wrap"
          >
            <span class="text-sm text-muted-foreground"> 该组件尚在开发规划中，暂无可用的配置控制台。 </span>
          </div>
        </Spin>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
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
  background: var(--brand-soft);
  color: var(--brand);
  border-radius: 8px;
  flex-shrink: 0;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--foreground);
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
