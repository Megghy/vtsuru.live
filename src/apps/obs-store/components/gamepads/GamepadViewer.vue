<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NColorPicker,
  NDivider,
  NFlex,
  NInput,
  NInputNumber,
  NSelect,
  NSlider,
  NSpace,
  NSwitch,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, defineAsyncComponent, ref } from 'vue'

import { controllerBodies, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useGamepadStore } from '@/store/useGamepadStore'
import type { GamepadType } from '@/types/gamepad'

const GamepadDisplay = defineAsyncComponent(() => import('./GamepadDisplay.vue'))

const message = useMessage()
const { copy, isSupported: isCopySupported } = useClipboard()

// --- 手柄与基础设置 ---
const selectedType = usePersistedStorage<GamepadType>('Setting.Gamepad.SelectedType', 'xbox')
const gamepadTypeOptions = [
  { label: 'Xbox Series / One', value: 'xbox' as GamepadType },
  { label: 'PlayStation (PS5/PS4)', value: 'ps' as GamepadType },
  { label: 'Nintendo Switch Pro', value: 'nintendo' as GamepadType },
]

const config = computed(() => gamepadConfigs[selectedType.value])
const bodies = computed(() => controllerBodies[selectedType.value] || [])
const bodyOptions = computed(() =>
  bodies.value.map((b) => ({ label: b.name, value: b.id })),
)

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
  get: () => customPressedColor.value !== null && customPressedColor.value !== 'null' && customPressedColor.value !== '',
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
  if (!isCopySupported) {
    message.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(displayAbsoluteUrl.value)
    message.success('OBS 浏览器源链接已复制到剪贴板！')
  } catch {
    message.error('复制失败，请手动复制')
  }
}
</script>

<template>
  <div class="gp-viewer-page">
    <NCard
      v-if="config"
      size="small"
      class="gp-viewer-card"
    >
      <!-- 顶部标题与 OBS 快捷操作 -->
      <NFlex
        justify="space-between"
        align="center"
        class="gp-header-row"
      >
        <div>
          <div class="gp-title">
            游戏手柄 OBS 渲染组件
          </div>
          <NText
            depth="3"
            style="font-size: 13px"
          >
            将玩家实时手柄操作（按键、双摇杆、线性扳机）以高帧率投射到 OBS 画面中
          </NText>
        </div>
        <NSpace size="small">
          <NButton
            type="primary"
            size="small"
            @click="copyObsUrl"
          >
            复制 OBS 链接
          </NButton>
          <NButton
            size="small"
            tag="a"
            :href="displayRelativeUrl"
            target="_blank"
          >
            新窗口打开
          </NButton>
        </NSpace>
      </NFlex>

      <NDivider style="margin: 12px 0" />

      <!-- 手柄连接状态与仿真开关 -->
      <NAlert
        v-if="gamepadStore.isSimulating"
        type="info"
        :bordered="false"
        style="margin-bottom: 12px"
      >
        <template #icon>
          <span style="font-weight: bold">SIM</span>
        </template>
        <NFlex
          justify="space-between"
          align="center"
        >
          <span>正在运行仿真测试演示动画（自动模拟摇杆画圆与按键交替触发）</span>
          <NButton
            size="tiny"
            type="warning"
            @click="gamepadStore.stopSimulation"
          >
            退出测试
          </NButton>
        </NFlex>
      </NAlert>
      <NAlert
        v-else-if="!gamepadStore.isGamepadConnected"
        type="warning"
        :bordered="false"
        style="margin-bottom: 12px"
      >
        <NFlex
          justify="space-between"
          align="center"
        >
          <span>未检测到游戏手柄连接。按下手柄任意按键唤醒，或开启动态仿真测试：</span>
          <NButton
            size="tiny"
            type="info"
            @click="gamepadStore.startSimulation"
          >
            开启仿真测试
          </NButton>
        </NFlex>
      </NAlert>
      <NAlert
        v-else
        type="success"
        :bordered="false"
        style="margin-bottom: 12px"
      >
        <NFlex
          justify="space-between"
          align="center"
        >
          <span>已连接设备: {{ gamepadStore.connectedGamepadInfo?.id || '标准 Gamepad' }}</span>
          <NTag
            size="small"
            type="success"
          >
            活跃
          </NTag>
        </NFlex>
      </NAlert>

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
          <NSpace size="small">
            <NButton
              size="tiny"
              :type="previewBg === 'checker' ? 'primary' : 'default'"
              @click="previewBg = 'checker'"
            >
              网格底
            </NButton>
            <NButton
              size="tiny"
              :type="previewBg === 'dark' ? 'primary' : 'default'"
              @click="previewBg = 'dark'"
            >
              暗黑底
            </NButton>
            <NButton
              size="tiny"
              :type="previewBg === 'transparent' ? 'primary' : 'default'"
              @click="previewBg = 'transparent'"
            >
              透明底
            </NButton>
          </NSpace>
        </div>
      </div>

      <NDivider style="margin: 14px 0 10px" />

      <!-- 主配置选项 -->
      <NFlex
        vertical
        size="small"
      >
        <!-- 手柄型号与底壳 -->
        <NFlex
          align="center"
          :wrap="true"
          size="medium"
        >
          <NFlex
            align="center"
            size="small"
          >
            <NText style="min-width: 70px">
              手柄类型:
            </NText>
            <NSelect
              v-model:value="selectedType"
              :options="gamepadTypeOptions"
              size="small"
              style="width: 180px"
            />
          </NFlex>

          <NFlex
            v-if="bodyOptions.length > 1"
            align="center"
            size="small"
          >
            <NText style="min-width: 70px">
              手柄外观:
            </NText>
            <NSelect
              v-model:value="selectedBodyId"
              :options="bodyOptions"
              size="small"
              style="width: 220px"
            />
          </NFlex>
        </NFlex>

        <!-- 按下效果颜色 -->
        <NFlex
          align="center"
          size="medium"
          style="margin-top: 6px"
        >
          <NCheckbox v-model:checked="enableCustomColor">
            自定义按键激活发光色
          </NCheckbox>
          <NColorPicker
            v-if="enableCustomColor"
            v-model:value="customPressedColor"
            :show-alpha="true"
            size="small"
            style="width: 130px"
          />
          <NText
            v-else
            depth="3"
            style="font-size: 12px"
          >
            (默认白光高亮)
          </NText>
        </NFlex>

        <!-- 摇杆灵敏度与死区 -->
        <NDivider
          title-placement="left"
          style="margin: 12px 0 6px; font-size: 13px"
        >
          摇杆参数微调
        </NDivider>

        <NFlex
          align="center"
          size="small"
          :wrap="true"
        >
          <NText style="width: 80px">
            推杆幅度:
          </NText>
          <NSlider
            v-model:value="stickSensitivity"
            :min="5"
            :max="50"
            :step="1"
            style="min-width: 180px; max-width: 280px"
          />
          <NInputNumber
            v-model:value="stickSensitivity"
            :min="5"
            :max="50"
            size="small"
            style="width: 80px"
          />
          <NButton
            size="small"
            @click="stickSensitivity = 15"
          >
            重置
          </NButton>
        </NFlex>

        <NFlex
          align="center"
          size="small"
          :wrap="true"
        >
          <NText style="width: 80px">
            中心死区:
          </NText>
          <NSlider
            v-model:value="gamepadStore.deadzone"
            :min="0.01"
            :max="0.25"
            :step="0.01"
            style="min-width: 180px; max-width: 280px"
          />
          <NInputNumber
            v-model:value="gamepadStore.deadzone"
            :min="0"
            :max="0.3"
            :step="0.01"
            size="small"
            style="width: 80px"
          />
          <NText
            depth="3"
            style="font-size: 12px"
          >
            (过滤手柄微小零点漂移，默认 0.08)
          </NText>
        </NFlex>

        <!-- OBS 使用指南 -->
        <NDivider
          title-placement="left"
          style="margin: 12px 0 6px; font-size: 13px"
        >
          OBS 浏览器源配置指南
        </NDivider>

        <div class="gp-obs-guide">
          <div class="gp-guide-step">
            1. 在 OBS「来源」窗口中点击 <b>+</b>，添加 <b>浏览器 (Browser)</b> 来源。
          </div>
          <div class="gp-guide-step">
            2. 将 URL 设为下方链接，推荐分辨率设为 <b>宽度 800，高度 500</b>（保持手柄比例）。
          </div>
          <div class="gp-guide-step">
            3. 勾选 <b>“关闭源时卸载浏览器”</b> 与 <b>“在 OBS 中控制音频”</b>（如有需要）。
          </div>
          <div class="gp-url-box">
            <NInput
              :value="displayAbsoluteUrl"
              readonly
              size="small"
            />
            <NButton
              size="small"
              type="primary"
              @click="copyObsUrl"
            >
              复制
            </NButton>
          </div>
        </div>

        <!-- 高级 ViewBox 设置 -->
        <NCollapse style="margin-top: 8px">
          <NCollapseItem title="高级布局与 ViewBox 微调">
            <NFlex
              align="center"
              size="small"
            >
              <NText>自定义 ViewBox:</NText>
              <NInput
                v-model:value="customViewBox"
                :placeholder="config.defaultViewBox"
                size="small"
                style="width: 220px"
              />
              <NButton
                size="small"
                @click="customViewBox = ''"
              >
                恢复默认
              </NButton>
            </NFlex>
          </NCollapseItem>
        </NCollapse>
      </NFlex>
    </NCard>

    <NCard v-else>
      无效的游戏手柄配置
    </NCard>
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

.gp-header-row {
  margin-bottom: 4px;
}

.gp-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--vtsuru-fg, inherit);
}

.gp-stage-wrapper {
  position: relative;
  width: 100%;
  height: 360px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background 0.2s ease;
}

.gp-stage-wrapper.bg-checker {
  background-color: var(--vtsuru-bg-inset, #18181c);
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.gp-stage-wrapper.bg-dark {
  background: #0f172a;
}

.gp-stage-wrapper.bg-transparent {
  background: transparent;
}

.gp-preview-inner {
  width: 90%;
  height: 90%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.gp-stage-overlay-tools {
  position: absolute;
  top: 8px;
  right: 8px;
}

.gp-obs-guide {
  background: var(--vtsuru-bg-muted, rgba(0, 0, 0, 0.03));
  border: 1px dashed var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
}

.gp-guide-step {
  color: var(--vtsuru-fg-muted);
  margin-bottom: 4px;
}

.gp-guide-step b {
  color: var(--vtsuru-fg);
}

.gp-url-box {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
