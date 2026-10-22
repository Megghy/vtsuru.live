<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, defineAsyncComponent, ref } from 'vue'
import { toast } from 'vue-sonner'

import { controllerBodies, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { useGamepadStore } from '@/store/useGamepadStore'
import type { GamepadType } from '@/types/gamepad'

const GamepadDisplay = defineAsyncComponent(() => import('./GamepadDisplay.vue'))

const { copy, isSupported: isCopySupported } = useClipboard()

// --- 手柄与基础设置 ---
const selectedType = usePersistedStorage<GamepadType>('Setting.Gamepad.SelectedType', 'xbox')
const gamepadTypeOptions: { label: string; value: GamepadType }[] = [
  { label: 'Xbox Series / One', value: 'xbox' },
  { label: 'PlayStation (PS5/PS4)', value: 'ps' },
  { label: 'Nintendo Switch Pro', value: 'nintendo' },
]

const config = computed(() => gamepadConfigs[selectedType.value])
const bodies = computed(() => controllerBodies[selectedType.value] || [])
const bodyOptions = computed(() => bodies.value.map((b) => ({ label: b.name, value: b.id })))

// --- 底壳与外观 ---
const bodyKey = computed(() => `gamepad-body-${selectedType.value}`)
const selectedBodyId = usePersistedStorage<string>(bodyKey, '')

// 确保选中的 body 有效
const validBodyId = computed(() => {
  if (bodies.value.length === 0) return ''
  if (bodies.value.some((b) => b.id === selectedBodyId.value || b.name === selectedBodyId.value)) {
    return selectedBodyId.value
  }
  return bodies.value[0].id
})

// --- 高亮效果与灵敏度 ---
const pressedColorKey = computed(() => `gamepad-pressed-color-${selectedType.value}`)
const customPressedColor = usePersistedStorage<string | null>(pressedColorKey, null)
const enableCustomColor = computed({
  get: () =>
    customPressedColor.value !== null && customPressedColor.value !== 'null' && customPressedColor.value !== '',
  set: (v) => {
    customPressedColor.value = v ? '#38bdf8' : null
  },
})

const sensitivityKey = computed(() => `gamepad-stick-sensitivity-${selectedType.value}`)
const stickSensitivity = usePersistedStorage<number>(sensitivityKey, 15)

const viewBoxKey = computed(() => `gamepad-viewBox-${selectedType.value}`)
const customViewBox = usePersistedStorage<string>(viewBoxKey, '')

// --- 预览背景 ---
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')

// --- 手柄 Store ---
const gamepadStore = useGamepadStore()

// 独立 OBS 浏览器源 URL
const displayRelativeUrl = computed(() => {
  const p = new URLSearchParams()
  p.set('type', selectedType.value)
  if (validBodyId.value) p.set('bodyId', validBodyId.value)
  if (enableCustomColor.value && customPressedColor.value) {
    p.set('pressedColor', customPressedColor.value)
  }
  if (customViewBox.value) p.set('viewBox', customViewBox.value)
  if (stickSensitivity.value !== 15) p.set('stickSensitivity', String(stickSensitivity.value))
  return `/obs-store/gamepad?${p.toString()}`
})

const displayAbsoluteUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${displayRelativeUrl.value}`
  }
  return displayRelativeUrl.value
})

async function copyObsUrl() {
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(displayAbsoluteUrl.value)
    toast.success('OBS 浏览器源链接已复制到剪贴板！')
  } catch {
    toast.error('复制失败，请手动复制')
  }
}
</script>

<template>
  <div class="gp-viewer-page">
    <Card
      v-if="config"
      class="gp-viewer-card p-4"
    >
      <CardContent class="p-0 space-y-3">
        <!-- 顶部标题与 OBS 快捷操作 -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="gp-title">游戏手柄 OBS 渲染组件</div>
            <div class="text-xs text-muted-foreground mt-0.5">
              将玩家实时手柄操作（按键、双摇杆、线性扳机）以高帧率投射到 OBS 画面中
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button @click="copyObsUrl"> 复制 OBS 链接 </Button>
            <Button
              variant="outline"
              as-child
            >
              <a
                :href="displayRelativeUrl"
                target="_blank"
              >
                新窗口打开
              </a>
            </Button>
          </div>
        </div>

        <div class="h-px bg-border my-2.5" />

        <!-- 手柄连接状态与仿真开关 -->
        <Alert
          v-if="gamepadStore.isSimulating"
          class="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 py-2.5 px-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-xs">
              <span class="font-bold">SIM</span>
              <AlertDescription class="text-xs text-current m-0">
                正在运行仿真测试演示动画（自动模拟摇杆画圆与按键交替触发）
              </AlertDescription>
            </div>
            <Button
              size="xs"
              variant="outline"
              class="h-6 text-[11px] border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              @click="gamepadStore.stopSimulation"
            >
              退出测试
            </Button>
          </div>
        </Alert>
        <Alert
          v-else-if="!gamepadStore.isGamepadConnected"
          class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2.5 px-3"
        >
          <div class="flex items-center justify-between gap-2">
            <AlertDescription class="text-xs text-current m-0">
              未检测到游戏手柄连接。按下手柄任意按键唤醒，或开启动态仿真测试：
            </AlertDescription>
            <Button
              size="xs"
              variant="outline"
              class="h-6 text-[11px] border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              @click="gamepadStore.startSimulation"
            >
              开启仿真测试
            </Button>
          </div>
        </Alert>
        <Alert
          v-else
          class="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-2.5 px-3"
        >
          <div class="flex items-center justify-between gap-2">
            <AlertDescription class="text-xs text-current m-0">
              已连接设备: {{ gamepadStore.connectedGamepadInfo?.id || '标准 Gamepad' }}
            </AlertDescription>
            <Badge
              variant="outline"
              class="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] h-5 px-1.5"
            >
              活跃
            </Badge>
          </div>
        </Alert>

        <!-- 实时手柄预览舞台 -->
        <div
          class="gp-stage-wrapper"
          :class="`bg-${previewBg}`"
        >
          <div class="gp-preview-inner">
            <GamepadDisplay
              :key="`${selectedType}-${validBodyId}`"
              :type="selectedType"
              :body-id="validBodyId"
              :pressed-color="enableCustomColor ? customPressedColor : null"
              :view-box="customViewBox || undefined"
              :inline-mode="true"
              :stick-sensitivity="stickSensitivity"
            />
          </div>

          <div class="gp-stage-overlay-tools">
            <div class="flex items-center gap-1.5">
              <Button
                size="xs"
                class="h-6 text-[11px] px-2"
                :variant="previewBg === 'checker' ? 'default' : 'outline'"
                @click="previewBg = 'checker'"
              >
                网格底
              </Button>
              <Button
                size="xs"
                class="h-6 text-[11px] px-2"
                :variant="previewBg === 'dark' ? 'default' : 'outline'"
                @click="previewBg = 'dark'"
              >
                暗黑底
              </Button>
              <Button
                size="xs"
                class="h-6 text-[11px] px-2"
                :variant="previewBg === 'transparent' ? 'default' : 'outline'"
                @click="previewBg = 'transparent'"
              >
                透明底
              </Button>
            </div>
          </div>
        </div>

        <div class="h-px bg-border my-3.5" />

        <!-- 主配置选项 -->
        <div class="flex flex-col gap-3">
          <!-- 手柄型号与底壳 -->
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-foreground min-w-[60px]">手柄类型:</span>
              <Select v-model="selectedType">
                <SelectTrigger class="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in gamepadTypeOptions"
                    :key="opt.value"
                    :value="opt.value"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              v-if="bodyOptions.length > 1"
              class="flex items-center gap-2"
            >
              <span class="text-xs text-foreground min-w-[60px]">手柄外观:</span>
              <Select v-model="selectedBodyId">
                <SelectTrigger class="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in bodyOptions"
                    :key="opt.value"
                    :value="opt.value"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- 按下效果颜色 -->
          <div class="flex items-center gap-3 mt-1.5">
            <label class="flex items-center gap-2 cursor-pointer text-xs font-medium">
              <Checkbox
                :checked="enableCustomColor"
                @update:checked="enableCustomColor = $event"
              />
              <span>自定义按键激活发光色</span>
            </label>

            <ColorPicker
              v-if="enableCustomColor"
              :model-value="customPressedColor || '#38bdf8'"
              @update:model-value="customPressedColor = $event"
            />
            <span
              v-else
              class="text-xs text-muted-foreground"
            >
              (默认白光高亮)
            </span>
          </div>

          <!-- 摇杆灵敏度与死区 -->
          <div class="flex items-center gap-2 my-2 text-xs font-semibold text-foreground">
            <span>摇杆参数微调</span>
            <div class="flex-1 h-px bg-border" />
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <span class="text-xs text-foreground w-[70px]">推杆幅度:</span>
            <Slider
              :model-value="[stickSensitivity]"
              :min="5"
              :max="50"
              :step="1"
              class="w-[180px] max-w-[280px]"
              @update:model-value="
                (val) => {
                  if (val?.[0] !== undefined) stickSensitivity = val[0]
                }
              "
            />
            <NInputNumber
              :value="stickSensitivity"
              :min="5"
              :max="50"
              size="small"
              class="w-[80px]"
              @update:value="stickSensitivity = $event || 15"
            />
            <Button
              size="xs"
              variant="outline"
              @click="stickSensitivity = 15"
            >
              重置
            </Button>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <span class="text-xs text-foreground w-[70px]">中心死区:</span>
            <Slider
              :model-value="[gamepadStore.deadzone]"
              :min="0.01"
              :max="0.25"
              :step="0.01"
              class="w-[180px] max-w-[280px]"
              @update:model-value="
                (val) => {
                  if (val?.[0] !== undefined) gamepadStore.deadzone = val[0]
                }
              "
            />
            <NInputNumber
              :value="gamepadStore.deadzone"
              :min="0"
              :max="0.3"
              :step="0.01"
              size="small"
              class="w-[80px]"
              @update:value="gamepadStore.deadzone = $event || 0.08"
            />
            <span class="text-xs text-muted-foreground"> (过滤手柄微小零点漂移，默认 0.08) </span>
          </div>

          <!-- OBS 使用指南 -->
          <div class="flex items-center gap-2 my-2 text-xs font-semibold text-foreground">
            <span>OBS 浏览器源配置指南</span>
            <div class="flex-1 h-px bg-border" />
          </div>

          <div class="gp-obs-guide">
            <div class="gp-guide-step">1. 在 OBS「来源」窗口中点击 <b>+</b>，添加 <b>浏览器 (Browser)</b> 来源。</div>
            <div class="gp-guide-step">
              2. 将 URL 设为下方链接，推荐分辨率设为 <b>宽度 800，高度 500</b>（保持手柄比例）。
            </div>
            <div class="gp-guide-step">
              3. 勾选 <b>“关闭源时卸载浏览器”</b> 与 <b>“在 OBS 中控制音频”</b>（如有需要）。
            </div>
            <div class="gp-url-box flex items-center gap-2 mt-2">
              <Input
                :value="displayAbsoluteUrl"
                readonly
                class="flex-1"
              />
              <Button @click="copyObsUrl"> 复制 </Button>
            </div>
          </div>

          <!-- 高级 ViewBox 设置 -->
          <details class="group mt-2 border rounded-md p-2.5 text-xs">
            <summary
              class="font-medium cursor-pointer list-none flex items-center justify-between text-muted-foreground hover:text-foreground"
            >
              <span>高级布局与 ViewBox 微调</span>
              <span class="transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div class="flex items-center gap-2 mt-3 pt-2 border-t">
              <span class="text-xs">自定义 ViewBox:</span>
              <Input
                v-model="customViewBox"
                :placeholder="config.defaultViewBox"
                class="w-[220px]"
              />
              <Button
                variant="outline"
                @click="customViewBox = ''"
              >
                恢复默认
              </Button>
            </div>
          </details>
        </div>
      </CardContent>
    </Card>

    <Card
      v-else
      class="p-6 text-center text-muted-foreground text-sm"
    >
      无效的游戏手柄配置
    </Card>
  </div>
</template>

<style scoped>
.gp-viewer-page {
  padding: 16px;
  box-sizing: border-box;
}

.gp-viewer-card {
  max-width: 800px;
  margin: 0 auto;
}

.gp-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--foreground);
}

.gp-stage-wrapper {
  position: relative;
  width: 100%;
  height: 280px;
  border-radius: 8px;
  border: 1px dashed var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gp-preview-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gp-stage-overlay-tools {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--popover);
  padding: 4px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.gp-obs-guide {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
}

.gp-guide-step {
  margin-bottom: 4px;
  color: var(--foreground);
}

.bg-checker {
  background-color: #1e1e24;
  background-image:
    linear-gradient(45deg, #2b2b36 25%, transparent 25%), linear-gradient(-45deg, #2b2b36 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2b2b36 75%), linear-gradient(-45deg, transparent 75%, #2b2b36 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}

.bg-dark {
  background: #09090b;
}

.bg-transparent {
  background: transparent;
}
</style>
