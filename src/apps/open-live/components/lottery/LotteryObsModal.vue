<script setup lang="ts">
import { Copy24Regular, Open24Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import LiveLotteryOBS from '@/apps/obs/pages/LiveLotteryOBS.vue'
import {
  buildLotteryObsUrl,
  type LotteryObsMode,
  type LotteryObsStyle,
} from '@/apps/open-live/components/lottery/lotteryUtils'
import { CURRENT_HOST } from '@/shared/config'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { copyToClipboard } from '@/shared/utils'

const props = defineProps<{
  show: boolean
  code?: string
  userId?: number | string | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const selectedMode = ref<LotteryObsMode>('card')
const selectedStyle = ref<LotteryObsStyle>('slate')

const modeOptions: Array<{ value: LotteryObsMode; label: string; desc: string }> = [
  { value: 'card', label: '标准卡片', desc: '侧边栏' },
  { value: 'banner', label: '横向长条', desc: '顶底栏' },
  { value: 'compact', label: '悬浮胶囊', desc: '小挂件' },
  { value: 'grid', label: '舞台网格', desc: '多列墙' },
]

const styleOptions: Array<{ value: LotteryObsStyle; label: string; desc: string }> = [
  { value: 'slate', label: '现代深邃', desc: '推荐' },
  { value: 'transparent', label: '纯粹悬浮', desc: '无底框' },
  { value: 'champagne', label: '温润香槟', desc: '微金光' },
  { value: 'classic', label: '经典暗色', desc: '兼容' },
]

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const url = computed(() =>
  buildLotteryObsUrl(CURRENT_HOST, props.userId, props.code, selectedStyle.value, selectedMode.value),
)

const recommendedSize = computed(() => {
  switch (selectedMode.value) {
    case 'banner':
      return { width: '680px', height: '54px', text: '宽 680px，高 54px（适合贴在画面顶部或底部）' }
    case 'compact':
      return { width: '220px', height: '64px', text: '宽 220px，高 64px（适合贴在角落作为微型小挂件）' }
    case 'grid':
      return { width: '380px', height: '280px', text: '宽 380px，高 280px（适合切屏到大舞台头像墙）' }
    case 'card':
    default:
      return { width: '260px', height: '420px', text: '宽 260px，高 420px（适合贴在左/右侧边栏）' }
  }
})

const previewBoxStyle = computed(() => {
  switch (selectedMode.value) {
    case 'banner':
      return { width: '100%', maxWidth: '380px', height: '54px' }
    case 'compact':
      return { width: '220px', height: '64px' }
    case 'grid':
      return { width: '100%', maxWidth: '340px', height: '260px' }
    case 'card':
    default:
      return { width: '260px', height: '380px' }
  }
})
</script>

<template>
  <Dialog v-model:open="showModel">
    <DialogContent class="max-w-[860px] max-h-[90vh] overflow-hidden flex flex-col p-6">
      <DialogHeader class="flex flex-row items-center justify-between pb-2 border-b">
        <DialogTitle class="text-base font-semibold">OBS 抽奖组件</DialogTitle>
        <Button
          v-if="url"
          as="a"
          variant="outline"
          target="_blank"
          :href="url"
          class="mr-6 gap-1"
        >
          <Open24Regular class="size-4" />
          浏览
        </Button>
      </DialogHeader>

      <div class="overflow-y-auto max-h-[calc(90vh-110px)] pr-1 pt-4">
        <div class="grid grid-cols-[minmax(320px,1fr)_300px] gap-6 items-start max-[720px]:grid-cols-1">
          <!-- 左侧：链接与配置 -->
          <div class="flex flex-col gap-4 min-w-0">
            <Alert class="text-xs py-2 bg-muted/50 border-muted">
              <AlertDescription> 将抽奖等待队列与中奖揭榜结果实时展示在 OBS 浏览器源中。 </AlertDescription>
            </Alert>

            <!-- 显示版型 -->
            <div class="flex flex-col gap-2">
              <div class="text-[13px] font-medium text-foreground">显示版型</div>
              <div class="grid grid-cols-2 gap-1.5 w-full">
                <button
                  v-for="opt in modeOptions"
                  :key="opt.value"
                  type="button"
                  class="flex-between py-1.5 px-2.5 rounded-md border border-border bg-background text-foreground cursor-pointer outline-none box-border transition hover:bg-popover hover:border-[var(--brand-tint,rgba(56,189,248,0.4))]"
                  :class="{
                    'bg-[var(--brand-soft,rgba(56,189,248,0.12))] border-[var(--brand,#38bdf8)] text-[var(--brand,#38bdf8)] font-semibold':
                      selectedMode === opt.value,
                  }"
                  @click="selectedMode = opt.value"
                >
                  <span class="text-xs">{{ opt.label }}</span>
                  <span class="text-[10px] text-muted-foreground bg-muted py-px px-1.5 rounded">{{ opt.desc }}</span>
                </button>
              </div>
            </div>

            <!-- 视觉风格 -->
            <div class="flex flex-col gap-2">
              <div class="text-[13px] font-medium text-foreground">视觉风格</div>
              <div class="grid grid-cols-2 gap-1.5 w-full">
                <button
                  v-for="opt in styleOptions"
                  :key="opt.value"
                  type="button"
                  class="flex-between py-1.5 px-2.5 rounded-md border border-border bg-background text-foreground cursor-pointer outline-none box-border transition hover:bg-popover hover:border-[var(--brand-tint,rgba(56,189,248,0.4))]"
                  :class="{
                    'bg-[var(--brand-soft,rgba(56,189,248,0.12))] border-[var(--brand,#38bdf8)] text-[var(--brand,#38bdf8)] font-semibold':
                      selectedStyle === opt.value,
                  }"
                  @click="selectedStyle = opt.value"
                >
                  <span class="text-xs">{{ opt.label }}</span>
                  <span class="text-[10px] text-muted-foreground bg-muted py-px px-1.5 rounded">{{ opt.desc }}</span>
                </button>
              </div>
            </div>

            <!-- 链接复制 -->
            <div class="flex flex-col gap-2">
              <div class="text-[13px] font-medium text-foreground">OBS 浏览器源链接</div>
              <Alert
                v-if="!url"
                class="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-xs py-2"
              >
                <AlertDescription class="text-xs text-amber-700 dark:text-amber-400">
                  未获取到用户信息，无法生成 OBS 链接。请先登录，或通过幻星平台打开本页。
                </AlertDescription>
              </Alert>
              <div
                v-else
                class="flex items-center gap-2"
              >
                <Input
                  :model-value="url"
                  readonly
                  class="font-mono"
                />
                <Button
                  class="shrink-0 gap-1.5"
                  @click="copyToClipboard(url)"
                >
                  <Copy24Regular class="size-4" />
                  复制
                </Button>
              </div>
            </div>

            <Accordion
              type="single"
              collapsible
              class="border rounded-md px-3 text-xs"
            >
              <AccordionItem
                value="help"
                class="border-none"
              >
                <AccordionTrigger class="py-2 text-xs hover:no-underline"> OBS 使用说明 </AccordionTrigger>
                <AccordionContent class="text-muted-foreground text-xs pb-3 space-y-1">
                  <p>1. 在 OBS 来源中添加一个新的「浏览器」源。</p>
                  <p>2. 将上方链接复制并粘贴到「URL」栏中。</p>
                  <p>3. 当前推荐尺寸：{{ recommendedSize.text }}。</p>
                  <p>4. 选择版型与风格后链接自动更新，直接点击「复制」即可。</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <!-- 右侧：实时预览 -->
          <div class="flex flex-col items-center gap-2">
            <div class="text-xs text-muted-foreground text-center">
              实时预览 ({{ recommendedSize.width }} × {{ recommendedSize.height }})
            </div>
            <div
              class="w-full h-[400px] flex-center border border-dashed border-border rounded-lg bg-muted p-3 box-border"
            >
              <div
                class="relative overflow-hidden transition"
                :style="previewBoxStyle"
              >
                <LiveLotteryOBS
                  :code="code"
                  :id="userId"
                  :style="selectedStyle"
                  :mode="selectedMode"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
