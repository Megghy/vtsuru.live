<script setup lang="ts">
import { Palette, Plus, RefreshCw, RotateCcw, Sparkles } from 'lucide-vue-next'
import { ref } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { newDeckTile } from '@/apps/client/store/vts/deck'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const customColor = ref('#ff6b9d')
const fadeTime = ref(0.3)
const refreshing = ref(false)

const TINT_PRESETS = [
  { name: '恢复原色', targetId: 'reset', color: '#ffffff', reset: true },
  { name: '彩虹循环', targetId: 'rainbow', color: '', rainbow: true },
  { name: '暗影黑化', targetId: '#3b3b4f', color: '#3b3b4f' },
  { name: '心动粉', targetId: '#ff8fb1', color: '#ff8fb1' },
  { name: '冰霜蓝', targetId: '#7dd3fc', color: '#7dd3fc' },
  { name: '暖日金', targetId: '#fcd34d', color: '#fcd34d' },
  { name: '警告红', targetId: '#f87171', color: '#f87171' },
  { name: '森系绿', targetId: '#86efac', color: '#86efac' },
] as const

function applyPresetTint(preset: (typeof TINT_PRESETS)[number]) {
  run(
    () =>
      vts.tintModel({
        colorHex: preset.color || undefined,
        rainbow: 'rainbow' in preset ? preset.rainbow : false,
        reset: 'reset' in preset ? preset.reset : false,
      }),
    `已应用：${preset.name}`,
  )
}

function applyCustomTint() {
  run(() => vts.tintModel({ colorHex: customColor.value }), '已应用染色')
}

function addTintToDeck(targetId: string, label: string, color?: string) {
  run(
    () => vts.upsertDeckTile({ ...newDeckTile('colorTint', targetId, label, '视觉'), color: color || undefined }),
    '已加入操作台',
  )
}

function togglePostProcessing(enabled: boolean) {
  run(() => vts.updatePostProcessing({ enabled, fadeTime: fadeTime.value }), enabled ? '已开启滤镜' : '已关闭滤镜')
}

function applyFilterPreset(preset: string) {
  run(() => vts.updatePostProcessing({ enabled: true, preset, fadeTime: fadeTime.value }), `已切换滤镜：${preset}`)
}

function addFilterToDeck(preset: string, label: string) {
  run(() => vts.upsertDeckTile(newDeckTile('postProcessing', preset, label, '视觉')), '已加入操作台')
}

function refreshPostProcessing() {
  if (refreshing.value) return
  refreshing.value = true
  run(async () => {
    try {
      await vts.refreshPostProcessing()
    } finally {
      refreshing.value = false
    }
  }, '已刷新滤镜列表')
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
    <!-- 模型染色 -->
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Palette class="size-4 text-primary" />
          <CardTitle>模型染色</CardTitle>
        </div>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          :disabled="!vts.connected"
          @click="run(() => vts.tintModel({ reset: true }), '已恢复原色')"
        >
          <RotateCcw class="size-3" />
          恢复原色
        </Button>
      </CardHeader>

      <CardContent class="p-3 space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div
            v-for="p in TINT_PRESETS"
            :key="p.name"
            class="flex items-center gap-1 min-w-0"
          >
            <Button
              variant="outline"
              class="flex-1 min-w-0 justify-start px-2 gap-1.5"
              :disabled="!vts.connected"
              @click="applyPresetTint(p)"
            >
              <span
                class="size-3 rounded-full shrink-0 border border-border"
                :style="
                  'rainbow' in p
                    ? { background: 'conic-gradient(#f87171,#fbbf24,#34d399,#60a5fa,#c084fc,#f87171)' }
                    : { backgroundColor: p.color }
                "
              />
              <span class="truncate">{{ p.name }}</span>
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              class="shrink-0 text-muted-foreground"
              title="加入操作台"
              @click="addTintToDeck(p.targetId, p.name, p.color || undefined)"
            >
              <Plus class="size-3" />
            </Button>
          </div>
        </div>

        <FormField
          label="自定义全模型染色"
          description="对模型全部 ArtMesh 应用叠加色，适合礼物/弹幕整活"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <ColorPicker
              :model-value="customColor"
              @update:model-value="(v: string) => (customColor = v || '#ffffff')"
            />
            <Button
              :disabled="!vts.connected"
              @click="applyCustomTint"
            >
              应用染色
            </Button>
            <Button
              variant="outline"
              class="gap-1"
              @click="addTintToDeck(customColor, '自定义染色', customColor)"
            >
              <Plus class="size-3.5" />
              加入操作台
            </Button>
          </div>
        </FormField>
      </CardContent>
    </Card>

    <!-- 后处理滤镜 -->
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Sparkles class="size-4 text-primary" />
          <CardTitle>后处理滤镜</CardTitle>
          <Badge
            v-if="vts.postProcessing"
            :variant="vts.postProcessing.active ? 'success' : 'secondary'"
            size="xs"
          >
            {{ vts.postProcessing.active ? vts.postProcessing.activePreset || '已开启' : '未开启' }}
          </Badge>
        </div>
        <Button
          size="xs"
          variant="secondary"
          class="gap-1"
          :disabled="!vts.connected || refreshing"
          @click="refreshPostProcessing"
        >
          <RefreshCw
            class="size-3"
            :class="refreshing ? 'animate-spin' : ''"
          />
          刷新
        </Button>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <div
          v-if="!vts.connected"
          class="py-6"
        >
          <Empty description="连接 VTS 后可读取并切换后处理滤镜预设" />
        </div>
        <div
          v-else-if="!vts.postProcessing || !vts.postProcessing.supported"
          class="py-6"
        >
          <Empty description="当前 VTube Studio 未启用或不支持后处理滤镜 API" />
        </div>
        <template v-else>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <SettingRow
              type="switch"
              variant="none"
              title="滤镜总开关"
              :model-value="vts.postProcessing.active"
              @update:model-value="togglePostProcessing"
            />
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">过渡 (s)</span>
              <NumberField
                v-model="fadeTime"
                :min="0"
                :max="5"
                :step="0.1"
                class="w-24"
              />
              <Button
                size="xs"
                variant="outline"
                class="gap-1"
                @click="addFilterToDeck('__off__', '关闭滤镜')"
              >
                <Plus class="size-3" />
                关闭入台
              </Button>
            </div>
          </div>

          <div
            v-if="vts.postProcessing.presets.length === 0"
            class="py-4"
          >
            <Empty description="VTS 中尚未保存任何后处理预设，请先在 VTS 视觉特效里创建预设" />
          </div>
          <div
            v-else
            class="grid grid-cols-2 sm:grid-cols-3 gap-2"
          >
            <div
              v-for="preset in vts.postProcessing.presets"
              :key="preset"
              class="flex items-center gap-1 min-w-0"
            >
              <Button
                :variant="
                  vts.postProcessing.active && vts.postProcessing.activePreset === preset ? 'default' : 'outline'
                "
                class="flex-1 min-w-0 justify-start px-2.5 truncate"
                @click="applyFilterPreset(preset)"
              >
                <span class="truncate">{{ preset }}</span>
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                class="shrink-0 text-muted-foreground"
                title="加入操作台"
                @click="addFilterToDeck(preset, preset)"
              >
                <Plus class="size-3" />
              </Button>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
