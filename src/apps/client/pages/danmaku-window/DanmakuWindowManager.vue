<script setup lang="ts">
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'

const danmakuWindow = useDanmakuWindow()
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
const emojiLoading = ref(false)

async function reloadEmoji() {
  emojiLoading.value = true
  try {
    await danmakuWindow.getEmojiData()
    feedback('success', '表情数据已重新加载')
  } finally {
    emojiLoading.value = false
  }
}

const filterTypeOptions = [
  { label: '弹幕消息', value: 'Message' },
  { label: '礼物', value: 'Gift' },
  { label: 'SC', value: 'SC' },
  { label: '舰长', value: 'Guard' },
  { label: '进场', value: 'Enter' },
  { label: '点赞', value: 'Like' },
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
  feedback('success', `已应用${names[preset]}主题预设`)
}

function resetWindowPosition() {
  danmakuWindow.setDanmakuWindowPosition(0, 0)
  feedback('success', '窗口位置已重置')
}
</script>

<template>
  <div
    vertical
    :size="12"
    class="client-readable"
  >
    <UCard
      size="small"
      bordered
    >
      <ClientPageHeader
        title="弹幕窗口管理"
        description="管理弹幕窗口的布局、外观、过滤与高级设置"
      >
        <template #footers>
          <UButton
            size="small"
            :color="danmakuWindow.isDanmakuWindowOpen ? 'warning' : 'primary'"
            @click="danmakuWindow.isDanmakuWindowOpen ? danmakuWindow.closeWindow() : danmakuWindow.openWindow()"
          >
            {{ danmakuWindow.isDanmakuWindowOpen ? '关闭弹幕窗口' : '打开弹幕窗口' }}
          </UButton>
        </template>
      </ClientPageHeader>
    </UCard>

    <UCard
      size="small"
      bordered
    >
      <div
        type="line"
        animated
      >
        <!-- 布局与位置 -->
        <section
          name="layout"
          tab="布局"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="窗口尺寸与位置"
              size="small"
              embedded
            >
              <div
                cols="1 m:2"
                responsive="screen"
                :x-gap="12"
                :y-gap="4"
              >
                <div>
                  <UFormField
                    label="宽度"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="danmakuWindow.danmakuWindowSetting.width"
                      :min="200"
                      :max="2000"
                      @update:value="
                        (v) =>
                          danmakuWindow.setDanmakuWindowSize(v as number, danmakuWindow.danmakuWindowSetting.height)
                      "
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="高度"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="danmakuWindow.danmakuWindowSetting.height"
                      :min="200"
                      :max="2000"
                      @update:value="
                        (v) => danmakuWindow.setDanmakuWindowSize(danmakuWindow.danmakuWindowSetting.width, v as number)
                      "
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="X"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="danmakuWindow.danmakuWindowSetting.x"
                      :min="0"
                      @update:value="() => danmakuWindow.updateWindowPosition()"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="Y"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="danmakuWindow.danmakuWindowSetting.y"
                      :min="0"
                      @update:value="() => danmakuWindow.updateWindowPosition()"
                    />
                  </UFormField>
                </div>
              </div>
              <div
                justify="end"
                style="margin-top: 8px"
              >
                <UButton
                  variant="soft"
                  size="small"
                  @click="resetWindowPosition"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                  重置位置
                </UButton>
              </div>
            </UCard>

            <UCard
              title="窗口行为"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <LabelItem label="总是置顶">
                  <USwitch v-model="danmakuWindow.danmakuWindowSetting.alwaysOnTop" />
                </LabelItem>
                <LabelItem label="鼠标穿透">
                  <USwitch v-model="danmakuWindow.danmakuWindowSetting.interactive" />
                </LabelItem>
              </div>
            </UCard>
          </div>
        </section>

        <!-- 外观 -->
        <section
          name="appearance"
          tab="外观"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="颜色"
              size="small"
              embedded
            >
              <div
                cols="1 m:2"
                responsive="screen"
                :x-gap="12"
                :y-gap="4"
              >
                <div>
                  <UFormField
                    label="弹幕背景"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="danmakuWindow.danmakuWindowSetting.backgroundColor"
                      :show-alpha="true"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="窗口背景"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="danmakuWindow.danmakuWindowSetting.windowBackgroundColor"
                      :show-alpha="true"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="文字颜色"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="danmakuWindow.danmakuWindowSetting.textColor"
                      :show-alpha="true"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="阴影颜色"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="danmakuWindow.danmakuWindowSetting.shadowColor"
                      :show-alpha="true"
                      :disabled="!danmakuWindow.danmakuWindowSetting.enableShadow"
                    />
                  </UFormField>
                </div>
              </div>
              <div
                style="margin-top: 8px"
                :size="8"
              >
                <UButton
                  size="small"
                  @click="applyPreset('dark')"
                >
                  暗色预设
                </UButton>
                <UButton
                  size="small"
                  @click="applyPreset('light')"
                >
                  亮色预设
                </UButton>
                <UButton
                  size="small"
                  @click="applyPreset('transparent')"
                >
                  透明预设
                </UButton>
              </div>
            </UCard>

            <UCard
              title="样式"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <UFormField
                  label="透明度"
                  label-placement="left"
                >
                  <USlider
                    v-model="danmakuWindow.danmakuWindowSetting.opacity"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    style="max-width: 300px"
                  />
                </UFormField>
                <UFormField
                  label="字体大小"
                  label-placement="left"
                >
                  <USlider
                    v-model="danmakuWindow.danmakuWindowSetting.fontSize"
                    :min="10"
                    :max="24"
                    :step="1"
                    style="max-width: 300px"
                  />
                </UFormField>
                <UFormField
                  label="圆角"
                  label-placement="left"
                >
                  <USlider
                    v-model="danmakuWindow.danmakuWindowSetting.borderRadius"
                    :min="0"
                    :max="20"
                    :step="1"
                    style="max-width: 300px"
                  />
                </UFormField>
                <UFormField
                  label="项目间距"
                  label-placement="left"
                >
                  <USlider
                    v-model="danmakuWindow.danmakuWindowSetting.itemSpacing"
                    :min="0"
                    :max="20"
                    :step="1"
                    style="max-width: 300px"
                  />
                </UFormField>
                <LabelItem label="启用阴影">
                  <USwitch v-model="danmakuWindow.danmakuWindowSetting.enableShadow" />
                </LabelItem>
              </div>
            </UCard>
          </div>
        </section>

        <!-- 内容 -->
        <section
          name="content"
          tab="内容"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="展示风格"
              size="small"
              embedded
            >
              <URadioGroup
                v-model="danmakuWindow.danmakuWindowSetting.displayStyle"
                :items="displayStyleOptions"
                orientation="horizontal"
              />

              <template v-if="danmakuWindow.danmakuWindowSetting.displayStyle === 'text'">
                <div
                  vertical
                  :size="4"
                  style="margin-top: 12px"
                >
                  <LabelItem label="紧凑布局">
                    <USwitch v-model="danmakuWindow.danmakuWindowSetting.textStyleCompact" />
                  </LabelItem>
                  <LabelItem label="显示消息类型标签">
                    <USwitch v-model="danmakuWindow.danmakuWindowSetting.textStyleShowType" />
                  </LabelItem>
                  <UFormField
                    label="用户名分隔符"
                    label-placement="left"
                  >
                    <USelectMenu
                      v-model="danmakuWindow.danmakuWindowSetting.textStyleNameSeparator"
                      :items="separatorOptions"
                      style="width: 160px"
                      value-key="value"
                    />
                  </UFormField>
                </div>
              </template>
            </UCard>

            <UCard
              title="信息过滤"
              size="small"
              embedded
            >
              <UCheckboxGroup
                v-model="danmakuWindow.danmakuWindowSetting.filterTypes"
                :items="filterTypeOptions"
                orientation="horizontal"
              />
            </UCard>

            <UCard
              title="显示元素"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <LabelItem label="显示头像">
                  <USwitch v-model="danmakuWindow.danmakuWindowSetting.showAvatar" />
                </LabelItem>
                <LabelItem label="显示用户名">
                  <USwitch v-model="danmakuWindow.danmakuWindowSetting.showUsername" />
                </LabelItem>
                <LabelItem label="显示粉丝牌">
                  <USwitch v-model="danmakuWindow.danmakuWindowSetting.showFansMedal" />
                </LabelItem>
                <LabelItem label="显示舰长图标">
                  <USwitch v-model="danmakuWindow.danmakuWindowSetting.showGuardIcon" />
                </LabelItem>
              </div>
            </UCard>
          </div>
        </section>

        <!-- 行为 -->
        <section
          name="behavior"
          tab="行为"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="弹幕方向与动画"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <LabelItem label="弹幕方向">
                  <div
                    align="center"
                    :size="8"
                  >
                    <span depth="3"> 从上往下 </span>
                    <USwitch v-model="danmakuWindow.danmakuWindowSetting.reverseOrder" />
                    <span depth="3"> 从下往上 </span>
                  </div>
                </LabelItem>
                <LabelItem label="启用动画">
                  <USwitch v-model="danmakuWindow.danmakuWindowSetting.enableAnimation" />
                </LabelItem>
                <UFormField
                  v-if="danmakuWindow.danmakuWindowSetting.enableAnimation"
                  label="动画时长"
                  label-placement="left"
                >
                  <div class="flex items-center gap-2">
                    <UInputNumber
                      v-model="danmakuWindow.danmakuWindowSetting.animationDuration"
                      :min="0"
                      :max="1000"
                      :step="50"
                    />
                    <span class="text-sm text-[var(--vtsuru-fg-muted)]">ms</span>
                  </div>
                </UFormField>
              </div>
            </UCard>

            <UCard
              title="数量与消失"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <UFormField
                  label="最大弹幕数量"
                  label-placement="left"
                >
                  <UInputNumber
                    v-model="danmakuWindow.danmakuWindowSetting.maxDanmakuCount"
                    :min="10"
                    :max="200"
                  />
                </UFormField>
                <UFormField
                  label="自动消失时间"
                  label-placement="left"
                >
                  <div class="flex items-center gap-2">
                    <UInputNumber
                      v-model="danmakuWindow.danmakuWindowSetting.autoDisappearTime"
                      :min="0"
                      :max="600"
                      :step="5"
                    />
                    <span class="text-sm text-[var(--vtsuru-fg-muted)]">秒</span>
                  </div>
                </UFormField>
                <span
                  depth="3"
                  style="font-size: 12px"
                >
                  {{
                    danmakuWindow.danmakuWindowSetting.autoDisappearTime > 0
                      ? `弹幕将在 ${danmakuWindow.danmakuWindowSetting.autoDisappearTime} 秒后自动消失`
                      : '设为 0 则弹幕不会自动消失'
                  }}
                </span>
              </div>
            </UCard>
          </div>
        </section>

        <!-- 高级 -->
        <section
          name="advanced"
          tab="高级"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="调试"
              size="small"
              embedded
            >
              <div
                :size="8"
                wrap
              >
                <UButton
                  size="small"
                  color="info"
                  @click="danmakuWindow.sendTestDanmaku()"
                >
                  发送测试弹幕
                </UButton>
                <UButton
                  size="small"
                  color="warning"
                  @click="danmakuWindow.clearAllDanmaku()"
                >
                  清空弹幕
                </UButton>
              </div>
            </UCard>

            <UCard
              title="表情数据"
              size="small"
              embedded
            >
              <div
                align="center"
                justify="space-between"
              >
                <span
                  depth="3"
                  style="font-size: 12px"
                >
                  Inline: {{ Object.keys(danmakuWindow.emojiData.data.inline).length }} 个 / Plain:
                  {{ Object.keys(danmakuWindow.emojiData.data.plain).length }} 个
                </span>
                <UButton
                  size="small"
                  :loading="emojiLoading"
                  @click="reloadEmoji"
                >
                  重新加载
                </UButton>
              </div>
            </UCard>
          </div>
        </section>
      </div>
    </UCard>
  </div>
</template>

<style scoped>
.u-form-item {
  margin-bottom: 4px;
}
</style>
