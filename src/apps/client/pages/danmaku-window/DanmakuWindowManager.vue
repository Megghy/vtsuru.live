<script setup lang="ts">
import {
  ArrowReset24Regular,
  Color24Filled,
  Delete24Regular,
  Desktop24Filled,
  Eye24Filled,
  Filter24Filled,
  Flash24Filled,
  Send24Filled,
} from '@vicons/fluent'
import {
  NButton,
  NButtonGroup,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NColorPicker,
  NFlex,
  NFormItem,
  NGi,
  NGrid,
  NIcon,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { ref } from 'vue'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'

const danmakuWindow = useDanmakuWindow()
const message = useMessage()
const emojiLoading = ref(false)

async function reloadEmoji() {
  emojiLoading.value = true
  try {
    await danmakuWindow.getEmojiData()
    message.success('表情数据已重新加载')
  } finally {
    emojiLoading.value = false
  }
}

const filterTypeOptions = [
  { label: '弹幕消息', value: 'Message' },
  { label: '礼物通知', value: 'Gift' },
  { label: '醒目留言 (SC)', value: 'SC' },
  { label: '大航海 (舰长)', value: 'Guard' },
  { label: '进场欢迎', value: 'Enter' },
  { label: '点赞互动', value: 'Like' },
]

const displayStyleOptions = [
  { label: '卡片风格', value: 'card' },
  { label: '纯文本风格', value: 'text' },
]

const separatorOptions = [
  { label: ': (冒号+空格)', value: ': ' },
  { label: '：(中文冒号)', value: '：' },
  { label: '> ', value: '> ' },
  { label: '| ', value: '| ' },
  { label: '- ', value: '- ' },
  { label: '→ ', value: '→ ' },
]

const presets = {
  dark: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.7)',
    enableShadow: true,
    borderRadius: 8,
    opacity: 0.95,
  },
  light: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#333333',
    shadowColor: 'rgba(0,0,0,0.2)',
    enableShadow: true,
    borderRadius: 8,
    opacity: 0.95,
  },
  transparent: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.0)',
    enableShadow: false,
    borderRadius: 8,
    opacity: 0.9,
  },
}

function applyPreset(preset: keyof typeof presets) {
  const data = presets[preset]
  Object.assign(danmakuWindow.danmakuWindowSetting, data)
  const names = { dark: '暗黑', light: '明亮', transparent: '透明' } as const
  message.success(`已应用${names[preset]}主题预设`)
}

function resetWindowPosition() {
  danmakuWindow.setDanmakuWindowPosition(0, 0)
  message.success('窗口位置已重置至默认坐标')
}
</script>

<template>
  <div class="danmaku-manage-view">
    <NFlex
      vertical
      :size="14"
    >
      <!-- 标准管理页标头 -->
      <ClientPageHeader
        title="弹幕机浮窗管理"
        description="桌面半透明置顶弹幕机，支持高自由度外观、穿透、卡片/纯文本样式与智能过滤"
      >
        <template #actions>
          <NTag
            :type="danmakuWindow.isDanmakuWindowOpen ? 'success' : 'default'"
            round
            :bordered="false"
          >
            {{ danmakuWindow.isDanmakuWindowOpen ? '● 浮窗运行中' : '○ 浮窗已关闭' }}
          </NTag>

          <NButton
            size="small"
            :type="danmakuWindow.isDanmakuWindowOpen ? 'error' : 'primary'"
            secondary
            @click="danmakuWindow.isDanmakuWindowOpen ? danmakuWindow.closeWindow() : danmakuWindow.openWindow()"
          >
            {{ danmakuWindow.isDanmakuWindowOpen ? '关闭浮窗' : '打开浮窗' }}
          </NButton>

          <NButtonGroup size="small">
            <NButton
              secondary
              type="info"
              :disabled="!danmakuWindow.isDanmakuWindowOpen"
              @click="danmakuWindow.sendTestDanmaku()"
            >
              <template #icon>
                <NIcon :component="Send24Filled" />
              </template>
              测试弹幕
            </NButton>
            <NButton
              secondary
              type="warning"
              :disabled="!danmakuWindow.isDanmakuWindowOpen"
              @click="danmakuWindow.clearAllDanmaku()"
            >
              <template #icon>
                <NIcon :component="Delete24Regular" />
              </template>
              清空
            </NButton>
          </NButtonGroup>
        </template>
      </ClientPageHeader>

      <!-- 统一 Segmented Tabs 导航 -->
      <NTabs
        type="segment"
        animated
        default-value="appearance"
        class="danmaku-tabs"
      >
        <!-- 外观与预设 -->
        <NTabPane
          name="appearance"
          tab="外观与预设"
        >
          <template #tab>
            <NFlex
              align="center"
              :size="6"
            >
              <NIcon :component="Color24Filled" />
              <span>外观与预设</span>
            </NFlex>
          </template>

          <NFlex
            vertical
            :size="12"
            class="client-readable"
          >
            <!-- 快速主题预设 -->
            <NCard
              title="主题预设"
              size="small"
              bordered
            >
              <NGrid
                cols="1 s:3"
                :x-gap="12"
                :y-gap="8"
              >
                <NGi>
                  <div
                    class="preset-card preset-card--dark"
                    @click="applyPreset('dark')"
                  >
                    <div class="preset-name">暗黑</div>
                    <div class="preset-desc">高对比暗色气泡，适合各类游戏背景</div>
                  </div>
                </NGi>
                <NGi>
                  <div
                    class="preset-card preset-card--light"
                    @click="applyPreset('light')"
                  >
                    <div class="preset-name">明亮</div>
                    <div class="preset-desc">温润浅底灰字，高清晰度可读性</div>
                  </div>
                </NGi>
                <NGi>
                  <div
                    class="preset-card preset-card--transparent"
                    @click="applyPreset('transparent')"
                  >
                    <div class="preset-name">透明</div>
                    <div class="preset-desc">超低透明背景，零视觉遮挡</div>
                  </div>
                </NGi>
              </NGrid>
            </NCard>

            <!-- 呈现风格 -->
            <NCard
              title="呈现模式"
              size="small"
              bordered
            >
              <NRadioGroup v-model:value="danmakuWindow.danmakuWindowSetting.displayStyle">
                <NFlex :size="12">
                  <NRadioButton
                    v-for="opt in displayStyleOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </NRadioButton>
                </NFlex>
              </NRadioGroup>

              <template v-if="danmakuWindow.danmakuWindowSetting.displayStyle === 'text'">
                <NFlex
                  vertical
                  :size="8"
                  style="margin-top: 14px"
                >
                  <LabelItem label="紧凑文本排版">
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.textStyleCompact" />
                  </LabelItem>
                  <LabelItem label="显示消息类型角标">
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.textStyleShowType" />
                  </LabelItem>
                  <NFormItem
                    label="用户名分隔符"
                    label-placement="left"
                    style="margin-bottom: 0"
                  >
                    <NSelect
                      v-model:value="danmakuWindow.danmakuWindowSetting.textStyleNameSeparator"
                      :options="separatorOptions"
                      style="width: 180px"
                    />
                  </NFormItem>
                </NFlex>
              </template>
            </NCard>

            <!-- 色彩调节 -->
            <NCard
              title="色彩与透明度"
              size="small"
              bordered
            >
              <NGrid
                cols="1 s:2"
                :x-gap="16"
                :y-gap="6"
              >
                <NGi>
                  <NFormItem
                    label="气泡背景色"
                    label-placement="left"
                  >
                    <NColorPicker
                      v-model:value="danmakuWindow.danmakuWindowSetting.backgroundColor"
                      :show-alpha="true"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="窗口底色"
                    label-placement="left"
                  >
                    <NColorPicker
                      v-model:value="danmakuWindow.danmakuWindowSetting.windowBackgroundColor"
                      :show-alpha="true"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="弹幕文字色"
                    label-placement="left"
                  >
                    <NColorPicker
                      v-model:value="danmakuWindow.danmakuWindowSetting.textColor"
                      :show-alpha="true"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="文字阴影色"
                    label-placement="left"
                  >
                    <NColorPicker
                      v-model:value="danmakuWindow.danmakuWindowSetting.shadowColor"
                      :show-alpha="true"
                      :disabled="!danmakuWindow.danmakuWindowSetting.enableShadow"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
            </NCard>

            <!-- 字体与排版细项 -->
            <NCard
              title="排版细项"
              size="small"
              bordered
            >
              <NFlex
                vertical
                :size="6"
              >
                <NFormItem
                  label="整体不透明度"
                  label-placement="left"
                >
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.opacity"
                    :min="0.1"
                    :max="1"
                    :step="0.05"
                    style="max-width: 320px"
                  />
                </NFormItem>
                <NFormItem
                  label="字体大小 (px)"
                  label-placement="left"
                >
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.fontSize"
                    :min="10"
                    :max="24"
                    :step="1"
                    style="max-width: 320px"
                  />
                </NFormItem>
                <NFormItem
                  label="气泡圆角 (px)"
                  label-placement="left"
                >
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.borderRadius"
                    :min="0"
                    :max="20"
                    :step="1"
                    style="max-width: 320px"
                  />
                </NFormItem>
                <NFormItem
                  label="条目间距 (px)"
                  label-placement="left"
                >
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.itemSpacing"
                    :min="0"
                    :max="24"
                    :step="1"
                    style="max-width: 320px"
                  />
                </NFormItem>
                <LabelItem label="启用文字阴影">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.enableShadow" />
                </LabelItem>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 窗口与行为 -->
        <NTabPane
          name="window"
          tab="窗口与行为"
        >
          <template #tab>
            <NFlex
              align="center"
              :size="6"
            >
              <NIcon :component="Desktop24Filled" />
              <span>窗口与行为</span>
            </NFlex>
          </template>

          <NFlex
            vertical
            :size="12"
            class="client-readable"
          >
            <!-- 尺寸与坐标 -->
            <NCard
              title="尺寸与屏幕坐标"
              size="small"
              bordered
            >
              <NGrid
                cols="2 s:4"
                :x-gap="12"
                :y-gap="6"
              >
                <NGi>
                  <NFormItem
                    label="宽度 (px)"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.width"
                      :min="200"
                      :max="3840"
                      @update:value="(v) => danmakuWindow.setDanmakuWindowSize(v as number, danmakuWindow.danmakuWindowSetting.height)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="高度 (px)"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.height"
                      :min="200"
                      :max="2160"
                      @update:value="(v) => danmakuWindow.setDanmakuWindowSize(danmakuWindow.danmakuWindowSetting.width, v as number)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="X 坐标"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.x"
                      :min="0"
                      @update:value="() => danmakuWindow.updateWindowPosition()"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="Y 坐标"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.y"
                      :min="0"
                      @update:value="() => danmakuWindow.updateWindowPosition()"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
              <NFlex
                justify="end"
                style="margin-top: 10px"
              >
                <NButton
                  secondary
                  size="small"
                  @click="resetWindowPosition"
                >
                  <template #icon>
                    <NIcon :component="ArrowReset24Regular" />
                  </template>
                  重置至默认坐标
                </NButton>
              </NFlex>
            </NCard>

            <!-- 窗口行为 -->
            <NCard
              title="浮窗行为属性"
              size="small"
              bordered
            >
              <NFlex
                vertical
                :size="10"
              >
                <LabelItem
                  label="总是置顶"
                  description="让弹幕窗口始终悬浮在游戏和其他全屏窗口上方"
                >
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.alwaysOnTop" />
                </LabelItem>
                <LabelItem
                  label="鼠标穿透 (点击忽略)"
                  description="开启后鼠标点击可直接穿透弹幕窗口操作底下的游戏"
                >
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.interactive" />
                </LabelItem>
              </NFlex>
            </NCard>

            <!-- 滚动与动画 -->
            <NCard
              title="滚动方向与动效"
              size="small"
              bordered
            >
              <NFlex
                vertical
                :size="10"
              >
                <LabelItem
                  label="滚动方向"
                  description="控制弹幕流是由下往上涌现还是由上往下推进"
                >
                  <NFlex
                    align="center"
                    :size="8"
                  >
                    <NText depth="3"> 从上往下 </NText>
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.reverseOrder" />
                    <NText depth="3"> 从下往上 </NText>
                  </NFlex>
                </LabelItem>
                <LabelItem label="入场淡入动画">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.enableAnimation" />
                </LabelItem>
                <NFormItem
                  v-if="danmakuWindow.danmakuWindowSetting.enableAnimation"
                  label="动画持续时间"
                  label-placement="left"
                  style="margin-bottom: 0"
                >
                  <NInputNumber
                    v-model:value="danmakuWindow.danmakuWindowSetting.animationDuration"
                    :min="0"
                    :max="1000"
                    :step="50"
                    style="width: 160px"
                  >
                    <template #suffix> ms </template>
                  </NInputNumber>
                </NFormItem>
              </NFlex>
            </NCard>

            <!-- 留存与清理 -->
            <NCard
              title="留存与自动清理"
              size="small"
              bordered
            >
              <NGrid
                cols="1 s:2"
                :x-gap="16"
                :y-gap="6"
              >
                <NGi>
                  <NFormItem
                    label="最大保留弹幕数"
                    label-placement="left"
                  >
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.maxDanmakuCount"
                      :min="10"
                      :max="200"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="自动消失时间 (秒)"
                    label-placement="left"
                  >
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.autoDisappearTime"
                      :min="0"
                      :max="600"
                      :step="5"
                    >
                      <template #suffix> 秒 </template>
                    </NInputNumber>
                  </NFormItem>
                </NGi>
              </NGrid>
              <NText
                depth="3"
                style="font-size: 12px; margin-top: 4px; display: block;"
              >
                {{
                  danmakuWindow.danmakuWindowSetting.autoDisappearTime > 0
                    ? `弹幕将在 ${danmakuWindow.danmakuWindowSetting.autoDisappearTime} 秒后自动淡出消失`
                    : '设置为 0 则弹幕不会超时消失，直至达到最大数量后顶替'
                }}
              </NText>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 过滤与高级 -->
        <NTabPane
          name="filter"
          tab="过滤与元素"
        >
          <template #tab>
            <NFlex
              align="center"
              :size="6"
            >
              <NIcon :component="Filter24Filled" />
              <span>过滤与元素</span>
            </NFlex>
          </template>

          <NFlex
            vertical
            :size="12"
            class="client-readable"
          >
            <!-- 事件类型过滤 -->
            <NCard
              title="事件类型接收过滤"
              size="small"
              bordered
            >
              <NCheckboxGroup v-model:value="danmakuWindow.danmakuWindowSetting.filterTypes">
                <NFlex
                  :size="[20, 10]"
                  wrap
                >
                  <NCheckbox
                    v-for="opt in filterTypeOptions"
                    :key="opt.value"
                    :value="opt.value"
                    :label="opt.label"
                  />
                </NFlex>
              </NCheckboxGroup>
            </NCard>

            <!-- 渲染元素显隐 -->
            <NCard
              title="展示元素显隐"
              size="small"
              bordered
            >
              <NGrid
                cols="2 s:4"
                :x-gap="12"
                :y-gap="8"
              >
                <NGi>
                  <LabelItem label="用户头像">
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.showAvatar" />
                  </LabelItem>
                </NGi>
                <NGi>
                  <LabelItem label="用户昵称">
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.showUsername" />
                  </LabelItem>
                </NGi>
                <NGi>
                  <LabelItem label="粉丝勋章">
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.showFansMedal" />
                  </LabelItem>
                </NGi>
                <NGi>
                  <LabelItem label="大航海标">
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.showGuardIcon" />
                  </LabelItem>
                </NGi>
              </NGrid>
            </NCard>

            <!-- 表情与资源 -->
            <NCard
              title="Bilibili 官方表情包数据"
              size="small"
              bordered
            >
              <NFlex
                align="center"
                justify="space-between"
              >
                <div>
                  <NText strong>本地表情缓存状态</NText>
                  <div style="font-size: 12px; color: var(--vtsuru-fg-muted); margin-top: 2px;">
                    内联表情: {{ Object.keys(danmakuWindow.emojiData?.data?.inline || {}).length }} 个 · 纯文本表情:
                    {{ Object.keys(danmakuWindow.emojiData?.data?.plain || {}).length }} 个
                  </div>
                </div>
                <NButton
                  size="small"
                  secondary
                  :loading="emojiLoading"
                  @click="reloadEmoji"
                >
                  重新同步表情
                </NButton>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>
      </NTabs>
    </NFlex>
  </div>
</template>

<style scoped>
.danmaku-manage-view {
  width: 100%;
}

.danmaku-tabs :deep(.n-tabs-rail) {
  max-width: 420px;
}

/* 预设卡片 */
.preset-card {
  padding: 14px;
  border-radius: var(--vtsuru-radius, 6px);
  cursor: pointer;
  border: 1px solid var(--vtsuru-border);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  box-sizing: border-box;
}

.preset-card:hover {
  border-color: var(--vtsuru-primary);
  transform: translateY(-2px);
  box-shadow: var(--vtsuru-shadow-1);
}

.preset-card--dark {
  background-color: #18181b;
  color: #fafafa;
}

.preset-card--light {
  background-color: #ffffff;
  color: #18181b;
}

.preset-card--transparent {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  backdrop-filter: blur(4px);
  color: var(--vtsuru-fg);
}

.preset-name {
  font-size: 13px;
  font-weight: 600;
}

.preset-desc {
  font-size: 11px;
  opacity: 0.75;
  line-height: 1.4;
}
</style>
