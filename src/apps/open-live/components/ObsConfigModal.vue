<script setup lang="ts">
import { Copy24Regular, Info24Filled, Open24Regular } from '@vicons/fluent'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { copyToClipboard } from '@/shared/utils'

type ObsStyle = 'classic' | 'fresh' | 'minimal'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** OBS 页面相对路径, 如 obs/queue、obs/live-request、obs/music-request */
    obsPath: string
    userId?: number
    /** 是否显示样式与滚动速度配置 (音乐点歌等无需) */
    showStyleOptions?: boolean
    speed?: number
    styleType?: ObsStyle
    description?: string
  }>(),
  {
    showStyleOptions: true,
    speed: 1,
    styleType: 'classic',
    description: '将等待队列以及结果显示在 OBS 中。',
  },
)

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:speed', value: number): void
  (e: 'update:styleType', value: ObsStyle): void
}>()

const accountInfo = useAccount()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})
const speedModel = computed({
  get: () => props.speed,
  set: (value) => emit('update:speed', value),
})
const styleModel = computed({
  get: () => props.styleType,
  set: (value) => emit('update:styleType', value),
})

const effectiveUserId = computed(() => props.userId || accountInfo.value?.id || 0)

const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: props.obsPath,
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: effectiveUserId.value,
    params: props.showStyleOptions
      ? {
          style: styleModel.value,
          speed: speedModel.value,
        }
      : undefined,
  }),
)
</script>

<template>
  <Dialog v-model:open="showModel">
    <DialogContent class="max-w-[880px] max-h-[90vh] overflow-hidden flex flex-col p-6">
      <DialogHeader class="flex flex-row items-center justify-between pb-2 border-b">
        <DialogTitle class="text-base font-semibold">OBS 组件</DialogTitle>
        <Button
          as="a"
          variant="outline"
          size="sm"
          target="_blank"
          :href="obsUrl"
          class="mr-6 gap-1"
        >
          <Open24Regular class="size-4" />
          浏览
        </Button>
      </DialogHeader>

      <div class="overflow-y-auto max-h-[calc(90vh-110px)] pr-1 pt-4">
        <div class="obs-config-modal__body">
          <!-- 左侧：操作、链接与配置 -->
          <div class="obs-config-modal__main">
            <Alert class="text-xs py-2 bg-muted/50 border-muted">
              <AlertDescription>{{ description }}</AlertDescription>
            </Alert>

            <!-- 核心区域：OBS 浏览器源链接与复制 -->
            <div class="obs-config-modal__section">
              <div class="obs-config-modal__section-title">OBS 浏览器源链接</div>
              <div class="flex items-center gap-2">
                <Input
                  :model-value="obsUrl"
                  readonly
                  placeholder="OBS 组件链接"
                  class="font-mono text-xs"
                />
                <Button
                  size="sm"
                  :disabled="!obsUrl"
                  class="shrink-0 gap-1.5"
                  @click="copyToClipboard(obsUrl)"
                >
                  <Copy24Regular class="size-4" />
                  复制
                </Button>
              </div>
            </div>

            <!-- 样式与速度配置 -->
            <div
              v-if="showStyleOptions"
              class="obs-config-modal__section"
            >
              <div class="obs-config-modal__section-title">样式与速度</div>
              <div class="flex flex-col gap-2.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    :variant="styleModel === 'classic' ? 'default' : 'outline'"
                    @click="styleModel = 'classic'"
                  >
                    经典黑色
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    :variant="styleModel === 'fresh' ? 'default' : 'outline'"
                    @click="styleModel = 'fresh'"
                  >
                    清新明亮
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    :variant="styleModel === 'minimal' ? 'default' : 'outline'"
                    @click="styleModel = 'minimal'"
                  >
                    极简透明
                  </Button>
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex items-center border rounded-md overflow-hidden text-xs w-[200px]">
                    <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">滚动速度</span>
                    <NInputNumber
                      v-model:value="speedModel"
                      size="small"
                      :min="0.5"
                      :max="5"
                      :step="0.1"
                      placeholder="1"
                      class="border-0 shadow-none flex-1"
                    />
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Info24Filled class="size-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p class="text-xs">数值越大滚动越快（0.5 ~ 5）</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            <!-- 使用说明折叠 -->
            <Accordion
              type="single"
              collapsible
              class="border rounded-md px-3 text-xs"
            >
              <AccordionItem
                value="help"
                class="border-none"
              >
                <AccordionTrigger class="py-2 text-xs hover:no-underline">
                  OBS 使用说明
                </AccordionTrigger>
                <AccordionContent class="text-muted-foreground text-xs pb-3 space-y-1">
                  <p>1. 在 OBS 来源中添加一个新的「浏览器」源。</p>
                  <p>2. 将上方链接复制并粘贴到「URL」栏中。</p>
                  <p>3. 推荐初始尺寸：宽 280px，高 500px（可按实际直播布局自由缩放）。</p>
                  <p>4. 右侧可实时预览组件视觉效果，调整好风格后直接复制链接使用。</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <!-- 右侧：实时预览 -->
          <div class="obs-config-modal__side">
            <div class="obs-config-modal__preview-label">实时预览 (280 × 500)</div>
            <div class="obs-config-modal__preview">
              <slot
                v-if="effectiveUserId"
                name="preview"
                :style-type="styleModel"
                :speed="speedModel"
              />
              <Empty
                v-else
                description="无法预览：未获取到用户信息"
                class="obs-config-modal__empty"
              />
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.obs-config-modal__body {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) 280px;
  gap: 24px;
  align-items: start;
}

@media (max-width: 720px) {
  .obs-config-modal__body {
    grid-template-columns: 1fr;
  }
}

.obs-config-modal__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.obs-config-modal__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.obs-config-modal__section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--vtsuru-fg);
}

.obs-config-modal__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.obs-config-modal__preview-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.obs-config-modal__preview {
  height: 500px;
  width: 280px;
  position: relative;
  border: 1px dashed var(--vtsuru-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vtsuru-bg-muted);
}

.obs-config-modal__empty {
  padding-top: 140px;
}
</style>
