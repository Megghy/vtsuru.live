<script setup lang="ts">
import { snapdom } from '@zumer/snapdom'
import { saveAs } from 'file-saver'
import { Download, Loader2, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { FanDetailResponse } from '@/api/fanProfile'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { Textarea } from '@/shared/ui/textarea'

const props = defineProps<{
  open: boolean
  detail: FanDetailResponse
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const account = useAccount()
const previewRef = ref<HTMLElement | null>(null)
const exporting = ref(false)

type BookletTheme = 'cyan-letter' | 'cream-receipt'
const theme = ref<BookletTheme>('cyan-letter')

// 展示字段开关：敏感项（生日 / 消费金额 / AI 画像）默认关闭，防止外发泄露
const includeStats = ref(true)
const includeMilestones = ref(true)
const includeBirthday = ref(false)
const includeSpending = ref(false)
const includeAiSummary = ref(false)
const selectedMemoryIds = ref<string[]>([])
const streamerMessage = ref('')

watch(
  () => [props.open, props.detail.canonicalOUId],
  ([open]) => {
    if (open) {
      selectedMemoryIds.value = (props.detail.memories ?? []).slice(0, 3).map((m) => m.id)
      if (!streamerMessage.value) {
        streamerMessage.value = '谢谢一直以来的陪伴，往后的每一场直播也要一起开心呀。'
      }
    }
  },
  { immediate: true },
)

const fanTitle = computed(
  () =>
    props.detail.nickname ||
    props.detail.latestKnownName ||
    (props.detail.uId ? `UID ${props.detail.uId}` : props.detail.canonicalOUId.slice(0, 8)),
)

const streamerName = computed(() => account.value.name || 'VTsuru 主播')

const accompanyDays = computed(() => {
  if (props.detail.guard?.accompanyDays && props.detail.guard.accompanyDays > 0) {
    return props.detail.guard.accompanyDays
  }
  if (!props.detail.firstActiveAt) return 0
  const ms = Date.now() - new Date(props.detail.firstActiveAt).getTime()
  return Math.max(1, Math.floor(ms / 86_400_000))
})

const visibleMilestones = computed(() =>
  includeMilestones.value ? (props.detail.milestones ?? []).slice(0, 4) : [],
)

const visibleMemories = computed(() => {
  const set = new Set(selectedMemoryIds.value)
  return (props.detail.memories ?? []).filter((m) => set.has(m.id)).slice(0, 4)
})

const todayText = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
})

function toggleMemory(id: string) {
  const idx = selectedMemoryIds.value.indexOf(id)
  if (idx >= 0) {
    selectedMemoryIds.value.splice(idx, 1)
  } else if (selectedMemoryIds.value.length < 4) {
    selectedMemoryIds.value.push(id)
  } else {
    toast.info('纪念卡最多勾选 4 条记忆片段，以保持排版舒展')
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10).replace(/-/g, '.')
}

async function handleExportPng() {
  if (!previewRef.value || exporting.value) return
  exporting.value = true
  try {
    const blob = await snapdom.toBlob(previewRef.value, {
      scale: 2,
      backgroundColor: theme.value === 'cyan-letter' ? '#f3fafb' : '#fbf7ee',
    })
    if (!blob) {
      toast.error('生成图片失败')
      return
    }
    const safeName = fanTitle.value.replace(/[\\/:*?"<>|]/g, '_')
    saveAs(blob, `纪念手册_${safeName}_${todayText.value}.png`)
    toast.success('已导出高清 PNG 纪念手册')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '导出图片失败')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-[860px] p-0 gap-0 overflow-hidden">
      <div class="px-5 py-4 border-b border-border flex-between gap-3">
        <DialogHeader class="space-y-0.5 text-left">
          <DialogTitle class="text-base flex items-center gap-1.5">
            <Sparkles class="size-4 text-primary" />
            生成粉丝纪念手册
          </DialogTitle>
          <DialogDescription class="text-xs">
            挑选陪伴里程碑与回忆片段导出 PNG，适合上舰周年、生日回馈发给粉丝；生日与消费默认不勾选。
          </DialogDescription>
        </DialogHeader>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-[340px_1fr] max-h-[78vh]">
        <!-- 左侧配置 -->
        <ScrollArea class="border-b md:border-b-0 md:border-r border-border [&_[data-reka-scroll-area-viewport]>div]:!block">
          <div class="p-4 space-y-4">
            <FormField label="视觉模板">
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="rounded-md border px-3 py-2 text-left transition-colors"
                  :class="
                    theme === 'cyan-letter'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent/50'
                  "
                  @click="theme = 'cyan-letter'"
                >
                  <div class="text-xs font-semibold">青色信纸</div>
                  <div class="text-[11px] opacity-75">LETTER OF MEMORIES</div>
                </button>
                <button
                  type="button"
                  class="rounded-md border px-3 py-2 text-left transition-colors"
                  :class="
                    theme === 'cream-receipt'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent/50'
                  "
                  @click="theme = 'cream-receipt'"
                >
                  <div class="text-xs font-semibold">奶油票据</div>
                  <div class="text-[11px] opacity-75">MEMORY RECEIPT</div>
                </button>
              </div>
            </FormField>

            <div class="space-y-2">
              <div class="text-xs font-medium text-foreground">展示内容</div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <label class="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    :model-value="includeStats"
                    @update:model-value="includeStats = Boolean($event)"
                  />
                  <span>陪伴场次统计</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    :model-value="includeMilestones"
                    @update:model-value="includeMilestones = Boolean($event)"
                  />
                  <span>一起经历的事</span>
                </label>
              </div>
            </div>

            <div class="space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
              <div class="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <ShieldCheck class="size-3.5 text-emerald-500" />
                隐私项（默认不导出，按需手动勾选）
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <label
                  v-if="detail.birthdayMonth && detail.birthdayDay"
                  class="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    :model-value="includeBirthday"
                    @update:model-value="includeBirthday = Boolean($event)"
                  />
                  <span>粉丝生日</span>
                </label>
                <label
                  v-if="detail.totalPrice > 0"
                  class="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    :model-value="includeSpending"
                    @update:model-value="includeSpending = Boolean($event)"
                  />
                  <span>累计支持金额</span>
                </label>
                <label
                  v-if="detail.aiSummary"
                  class="flex items-center gap-2 cursor-pointer col-span-2"
                >
                  <Checkbox
                    :model-value="includeAiSummary"
                    @update:model-value="includeAiSummary = Boolean($event)"
                  />
                  <span>附带 AI 印象寄语</span>
                </label>
              </div>
            </div>

            <div
              v-if="detail.memories.length > 0"
              class="space-y-2"
            >
              <div class="text-xs font-medium text-foreground">
                勾选回忆片段（{{ selectedMemoryIds.length }}/4）
              </div>
              <div class="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-thin pr-1">
                <label
                  v-for="m in detail.memories"
                  :key="m.id"
                  class="flex items-start gap-2 rounded-md border border-border bg-card p-2 text-xs cursor-pointer hover:bg-accent/30"
                >
                  <Checkbox
                    class="mt-0.5"
                    :model-value="selectedMemoryIds.includes(m.id)"
                    @update:model-value="toggleMemory(m.id)"
                  />
                  <span class="line-clamp-2 wrap-anywhere leading-relaxed">{{ m.content }}</span>
                </label>
              </div>
            </div>

            <FormField label="主播的一句话">
              <Textarea
                v-model="streamerMessage"
                rows="3"
                maxlength="180"
                placeholder="写一句想送给 TA 的话…"
              />
            </FormField>

            <Separator />

            <Button
              class="w-full"
              :disabled="exporting"
              @click="handleExportPng"
            >
              <Loader2
                v-if="exporting"
                class="size-3.5 mr-1.5 animate-spin"
              />
              <Download
                v-else
                class="size-3.5 mr-1.5"
              />
              导出高清 PNG 纪念手册
            </Button>
          </div>
        </ScrollArea>

        <!-- 右侧实时卡片预览 -->
        <ScrollArea class="bg-muted/40 [&_[data-reka-scroll-area-viewport]>div]:!block">
          <div class="p-6 flex justify-center">
            <!-- 模板 1：青色信纸 -->
            <div
              v-if="theme === 'cyan-letter'"
              ref="previewRef"
              class="w-[380px] rounded-xl p-6 shadow-sm border"
              style="
                background: linear-gradient(180deg, #eef9fa 0%, #ffffff 32%, #f6fbfb 100%);
                border-color: #bfe4e8;
                color: #163238;
              "
            >
              <div class="flex items-center justify-between pb-3 border-b" style="border-color: #cde8eb">
                <div>
                  <div class="text-[10px] tracking-[0.2em] font-semibold uppercase" style="color: #0e7490">
                    LETTER OF MEMORIES
                  </div>
                  <div class="text-xs mt-0.5" style="color: #4b6b73">
                    致 · 珍贵的陪伴回忆
                  </div>
                </div>
                <div class="text-[11px] font-mono" style="color: #5b7c84">
                  {{ todayText }}
                </div>
              </div>

              <div class="mt-4">
                <div class="text-xl font-bold tracking-tight" style="color: #0c2c33">
                  Dear {{ fanTitle }}
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]" style="color: #3f666f">
                  <span v-if="detail.firstActiveAt">初遇于 {{ formatDate(detail.firstActiveAt) }}</span>
                  <span v-if="accompanyDays > 0">· 已相伴 {{ accompanyDays }} 天</span>
                  <span v-if="includeBirthday && detail.birthdayMonth && detail.birthdayDay">
                    · 生日 {{ detail.birthdayMonth }}月{{ detail.birthdayDay }}日
                  </span>
                </div>
              </div>

              <div
                v-if="includeStats"
                class="mt-4 grid grid-cols-3 gap-2 rounded-lg p-2.5 text-center"
                style="background: rgba(14, 116, 144, 0.06); border: 1px solid #d4ecef"
              >
                <div>
                  <div class="text-[10px]" style="color: #4b6b73">共同场次</div>
                  <div class="text-sm font-bold tabular-nums mt-0.5" style="color: #0e7490">
                    {{ detail.liveCount }} 场
                  </div>
                </div>
                <div>
                  <div class="text-[10px]" style="color: #4b6b73">互动弹幕</div>
                  <div class="text-sm font-bold tabular-nums mt-0.5" style="color: #0e7490">
                    {{ detail.danmakuCount }} 条
                  </div>
                </div>
                <div>
                  <div class="text-[10px]" style="color: #4b6b73">
                    {{ includeSpending ? '累计支持' : '总互动' }}
                  </div>
                  <div class="text-sm font-bold tabular-nums mt-0.5" style="color: #0e7490">
                    {{ includeSpending ? `¥${detail.totalPrice.toFixed(0)}` : `${detail.interactCount} 次` }}
                  </div>
                </div>
              </div>

              <div
                v-if="visibleMilestones.length > 0"
                class="mt-4 space-y-2"
              >
                <div class="text-[11px] font-semibold tracking-wider uppercase" style="color: #0e7490">
                  一起经历的事
                </div>
                <div class="space-y-1.5 border-l-2 pl-3" style="border-color: #99d5dd">
                  <div
                    v-for="ms in visibleMilestones"
                    :key="ms.key"
                    class="text-xs"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-medium">{{ ms.title }}</span>
                      <span class="text-[10px] font-mono shrink-0" style="color: #5b7c84">{{ formatDate(ms.date) }}</span>
                    </div>
                    <div class="text-[11px] leading-snug" style="color: #4b6b73">{{ ms.detail }}</div>
                  </div>
                </div>
              </div>

              <div
                v-if="visibleMemories.length > 0"
                class="mt-4 space-y-1.5"
              >
                <div class="text-[11px] font-semibold tracking-wider uppercase" style="color: #0e7490">
                  珍藏片段
                </div>
                <div
                  v-for="m in visibleMemories"
                  :key="m.id"
                  class="rounded-md px-2.5 py-2 text-xs leading-relaxed"
                  style="background: #ffffff; border: 1px solid #d4ecef"
                >
                  「{{ m.content }}」
                </div>
              </div>

              <div
                v-if="includeAiSummary && detail.aiSummary"
                class="mt-4 rounded-md px-3 py-2 text-[11px] leading-relaxed"
                style="background: rgba(14, 116, 144, 0.05); color: #365a62"
              >
                {{ detail.aiSummary }}
              </div>

              <div
                v-if="streamerMessage.trim()"
                class="mt-4 pt-3 border-t"
                style="border-color: #cde8eb"
              >
                <div class="text-[10px] tracking-wider uppercase mb-1" style="color: #0e7490">
                  FROM {{ streamerName }}
                </div>
                <p class="text-xs leading-relaxed whitespace-pre-wrap" style="color: #163238">
                  {{ streamerMessage.trim() }}
                </p>
              </div>

              <div class="mt-4 pt-2 border-t flex items-center justify-between text-[10px]" style="border-color: #dfeff1; color: #70929a">
                <span>VTsuru 粉丝纪念手册</span>
                <span>{{ streamerName }}</span>
              </div>
            </div>

            <!-- 模板 2：奶油票据 -->
            <div
              v-else
              ref="previewRef"
              class="w-[360px] rounded-md p-6 shadow-sm border font-mono"
              style="
                background: #fbf7ee;
                border-color: #e5dac3;
                color: #3a3126;
              "
            >
              <div class="text-center pb-3 border-b border-dashed" style="border-color: #cfc0a4">
                <div class="text-[10px] tracking-[0.25em] uppercase" style="color: #8c7656">
                  MEMORY RECEIPT
                </div>
                <div class="text-base font-bold mt-1" style="color: #2b2319">
                  {{ streamerName }} 的回忆小票
                </div>
                <div class="text-[11px] mt-0.5" style="color: #7c6b54">
                  DATE {{ todayText }} · NO.{{ detail.canonicalOUId.slice(0, 6).toUpperCase() }}
                </div>
              </div>

              <div class="py-3 border-b border-dashed space-y-1 text-xs" style="border-color: #cfc0a4">
                <div class="flex justify-between">
                  <span style="color: #7c6b54">GUEST</span>
                  <span class="font-bold">{{ fanTitle }}</span>
                </div>
                <div
                  v-if="detail.firstActiveAt"
                  class="flex justify-between"
                >
                  <span style="color: #7c6b54">FIRST MET</span>
                  <span>{{ formatDate(detail.firstActiveAt) }}</span>
                </div>
                <div
                  v-if="includeBirthday && detail.birthdayMonth && detail.birthdayDay"
                  class="flex justify-between"
                >
                  <span style="color: #7c6b54">BIRTHDAY</span>
                  <span>{{ detail.birthdayMonth }}/{{ detail.birthdayDay }}</span>
                </div>
              </div>

              <div
                v-if="includeStats"
                class="py-3 border-b border-dashed space-y-1 text-xs"
                style="border-color: #cfc0a4"
              >
                <div class="flex justify-between">
                  <span>共同直播场次</span>
                  <span class="font-semibold">{{ detail.liveCount }} 场</span>
                </div>
                <div class="flex justify-between">
                  <span>留下弹幕</span>
                  <span class="font-semibold">{{ detail.danmakuCount }} 条</span>
                </div>
                <div class="flex justify-between">
                  <span>累计互动</span>
                  <span class="font-semibold">{{ detail.interactCount }} 次</span>
                </div>
                <div
                  v-if="includeSpending"
                  class="flex justify-between"
                >
                  <span>心意支持</span>
                  <span class="font-semibold">¥{{ detail.totalPrice.toFixed(0) }}</span>
                </div>
              </div>

              <div
                v-if="visibleMilestones.length > 0"
                class="py-3 border-b border-dashed space-y-2"
                style="border-color: #cfc0a4"
              >
                <div class="text-[10px] tracking-widest uppercase" style="color: #8c7656">
                  MILESTONES
                </div>
                <div
                  v-for="ms in visibleMilestones"
                  :key="ms.key"
                  class="text-[11px] space-y-0.5"
                >
                  <div class="flex justify-between gap-2 font-semibold">
                    <span>* {{ ms.title }}</span>
                    <span style="color: #7c6b54">{{ formatDate(ms.date) }}</span>
                  </div>
                  <div class="pl-3" style="color: #6b5c48">{{ ms.detail }}</div>
                </div>
              </div>

              <div
                v-if="visibleMemories.length > 0"
                class="py-3 border-b border-dashed space-y-1.5"
                style="border-color: #cfc0a4"
              >
                <div class="text-[10px] tracking-widest uppercase" style="color: #8c7656">
                  MEMORIES
                </div>
                <div
                  v-for="m in visibleMemories"
                  :key="m.id"
                  class="text-[11px] leading-relaxed"
                >
                  &gt; {{ m.content }}
                </div>
              </div>

              <div
                v-if="includeAiSummary && detail.aiSummary"
                class="py-3 border-b border-dashed text-[11px] leading-relaxed"
                style="border-color: #cfc0a4; color: #5b4d3c"
              >
                {{ detail.aiSummary }}
              </div>

              <div
                v-if="streamerMessage.trim()"
                class="py-3 text-xs leading-relaxed whitespace-pre-wrap"
              >
                “{{ streamerMessage.trim() }}”
              </div>

              <div class="pt-3 border-t border-dashed text-center space-y-1" style="border-color: #cfc0a4">
                <div class="text-[10px] tracking-[0.35em]" style="color: #9e8a6c">
                  |||| ||| || |||| || |||
                </div>
                <div class="text-[10px]" style="color: #8c7656">
                  THANK YOU FOR STAYING · VTSURU
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </DialogContent>
  </Dialog>
</template>
