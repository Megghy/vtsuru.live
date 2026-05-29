<script setup lang="ts">
import { ResizeTable24Filled } from '@vicons/fluent'
import { NButton, NCard, NCheckbox, NCheckboxGroup, NColorPicker, NFlex, NFormItem, NGi, NGrid, NIcon, NInputNumber, NRadioButton, NRadioGroup, NSelect, NSlider, NSwitch, NTabPane, NTabs, NText, useMessage } from 'naive-ui'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'

const danmakuWindow = useDanmakuWindow()
const message = useMessage()

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
  dark: { backgroundColor: 'rgba(0,0,0,0.8)', textColor: '#ffffff', shadowColor: 'rgba(0,0,0,0.7)' },
  light: { backgroundColor: 'rgba(255,255,255,0.8)', textColor: '#333333', shadowColor: 'rgba(0,0,0,0.2)' },
  transparent: { backgroundColor: 'rgba(0,0,0,0.3)', textColor: '#ffffff', shadowColor: 'rgba(0,0,0,0.0)' },
}

function applyPreset(preset: keyof typeof presets) {
  const data = presets[preset]
  Object.assign(danmakuWindow.danmakuWindowSetting, data)
  const names = { dark: '暗黑', light: '明亮', transparent: '透明' } as const
  message.success(`已应用${names[preset]}主题预设`)
}
</script>

<template>
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <ClientPageHeader
        title="弹幕窗口管理"
        description="管理弹幕窗口的布局、外观、过滤与高级设置"
      >
        <template #actions>
          <NButton
            size="small"
            :type="danmakuWindow.isDanmakuWindowOpen ? 'warning' : 'primary'"
            @click="danmakuWindow.isDanmakuWindowOpen ? danmakuWindow.closeWindow() : danmakuWindow.openWindow()"
          >
            {{ danmakuWindow.isDanmakuWindowOpen ? '关闭弹幕窗口' : '打开弹幕窗口' }}
          </NButton>
        </template>
      </ClientPageHeader>
    </NCard>

    <NCard size="small" bordered>
      <NTabs type="line" animated>
        <!-- 布局与位置 -->
        <NTabPane name="layout" tab="布局">
          <NFlex vertical :size="12">
            <NCard title="窗口尺寸与位置" size="small" bordered>
              <NGrid cols="1 m:2" responsive="screen" :x-gap="12" :y-gap="4">
                <NGi>
                  <NFormItem label="宽度" label-placement="left">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.width"
                      :min="200" :max="2000"
                      @update:value="(v) => danmakuWindow.setDanmakuWindowSize(v as number, danmakuWindow.danmakuWindowSetting.height)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="高度" label-placement="left">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.height"
                      :min="200" :max="2000"
                      @update:value="(v) => danmakuWindow.setDanmakuWindowSize(danmakuWindow.danmakuWindowSetting.width, v as number)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="X" label-placement="left">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.x"
                      :min="0"
                      @update:value="() => danmakuWindow.updateWindowPosition()"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="Y" label-placement="left">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.y"
                      :min="0"
                      @update:value="() => danmakuWindow.updateWindowPosition()"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
              <NFlex justify="end" style="margin-top: 8px">
                <NButton secondary size="small" @click="danmakuWindow.setDanmakuWindowPosition(0, 0); message.success('窗口位置已重置')">
                  <template #icon>
                    <NIcon :component="ResizeTable24Filled" />
                  </template>
                  重置位置
                </NButton>
              </NFlex>
            </NCard>

            <NCard title="窗口行为" size="small" bordered>
              <NFlex vertical :size="4">
                <LabelItem label="总是置顶">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.alwaysOnTop" />
                </LabelItem>
                <LabelItem label="鼠标穿透">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.interactive" />
                </LabelItem>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 外观 -->
        <NTabPane name="appearance" tab="外观">
          <NFlex vertical :size="12">
            <NCard title="颜色" size="small" bordered>
              <NGrid cols="1 m:2" responsive="screen" :x-gap="12" :y-gap="4">
                <NGi>
                  <NFormItem label="弹幕背景" label-placement="left">
                    <NColorPicker v-model:value="danmakuWindow.danmakuWindowSetting.backgroundColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="窗口背景" label-placement="left">
                    <NColorPicker v-model:value="danmakuWindow.danmakuWindowSetting.windowBackgroundColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="文字颜色" label-placement="left">
                    <NColorPicker v-model:value="danmakuWindow.danmakuWindowSetting.textColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="阴影颜色" label-placement="left">
                    <NColorPicker
                      v-model:value="danmakuWindow.danmakuWindowSetting.shadowColor"
                      :show-alpha="true"
                      :disabled="!danmakuWindow.danmakuWindowSetting.enableShadow"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
              <NFlex style="margin-top: 8px" :size="8">
                <NButton size="small" @click="applyPreset('dark')">
                  暗色预设
                </NButton>
                <NButton size="small" @click="applyPreset('light')">
                  亮色预设
                </NButton>
                <NButton size="small" @click="applyPreset('transparent')">
                  透明预设
                </NButton>
              </NFlex>
            </NCard>

            <NCard title="样式" size="small" bordered>
              <NFlex vertical :size="4">
                <NFormItem label="透明度" label-placement="left">
                  <NSlider v-model:value="danmakuWindow.danmakuWindowSetting.opacity" :min="0" :max="1" :step="0.05" style="max-width: 300px" />
                </NFormItem>
                <NFormItem label="字体大小" label-placement="left">
                  <NSlider v-model:value="danmakuWindow.danmakuWindowSetting.fontSize" :min="10" :max="24" :step="1" style="max-width: 300px" />
                </NFormItem>
                <NFormItem label="圆角" label-placement="left">
                  <NSlider v-model:value="danmakuWindow.danmakuWindowSetting.borderRadius" :min="0" :max="20" :step="1" style="max-width: 300px" />
                </NFormItem>
                <NFormItem label="项目间距" label-placement="left">
                  <NSlider v-model:value="danmakuWindow.danmakuWindowSetting.itemSpacing" :min="0" :max="20" :step="1" style="max-width: 300px" />
                </NFormItem>
                <LabelItem label="启用阴影">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.enableShadow" />
                </LabelItem>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 内容 -->
        <NTabPane name="content" tab="内容">
          <NFlex vertical :size="12">
            <NCard title="展示风格" size="small" bordered>
              <NRadioGroup v-model:value="danmakuWindow.danmakuWindowSetting.displayStyle">
                <NFlex>
                  <NRadioButton v-for="opt in displayStyleOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </NRadioButton>
                </NFlex>
              </NRadioGroup>

              <template v-if="danmakuWindow.danmakuWindowSetting.displayStyle === 'text'">
                <NFlex vertical :size="4" style="margin-top: 12px">
                  <LabelItem label="紧凑布局">
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.textStyleCompact" />
                  </LabelItem>
                  <LabelItem label="显示消息类型标签">
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.textStyleShowType" />
                  </LabelItem>
                  <NFormItem label="用户名分隔符" label-placement="left">
                    <NSelect
                      v-model:value="danmakuWindow.danmakuWindowSetting.textStyleNameSeparator"
                      :options="separatorOptions"
                      style="width: 160px"
                    />
                  </NFormItem>
                </NFlex>
              </template>
            </NCard>

            <NCard title="信息过滤" size="small" bordered>
              <NCheckboxGroup v-model:value="danmakuWindow.danmakuWindowSetting.filterTypes">
                <NFlex :size="[16, 8]" wrap>
                  <NCheckbox v-for="opt in filterTypeOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
                </NFlex>
              </NCheckboxGroup>
            </NCard>

            <NCard title="显示元素" size="small" bordered>
              <NFlex vertical :size="4">
                <LabelItem label="显示头像">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.showAvatar" />
                </LabelItem>
                <LabelItem label="显示用户名">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.showUsername" />
                </LabelItem>
                <LabelItem label="显示粉丝牌">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.showFansMedal" />
                </LabelItem>
                <LabelItem label="显示舰长图标">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.showGuardIcon" />
                </LabelItem>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 行为 -->
        <NTabPane name="behavior" tab="行为">
          <NFlex vertical :size="12">
            <NCard title="弹幕方向与动画" size="small" bordered>
              <NFlex vertical :size="4">
                <LabelItem label="弹幕方向">
                  <NFlex align="center" :size="8">
                    <NText depth="3">
                      从上往下
                    </NText>
                    <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.reverseOrder" />
                    <NText depth="3">
                      从下往上
                    </NText>
                  </NFlex>
                </LabelItem>
                <LabelItem label="启用动画">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.enableAnimation" />
                </LabelItem>
                <NFormItem v-if="danmakuWindow.danmakuWindowSetting.enableAnimation" label="动画时长" label-placement="left">
                  <NInputNumber
                    v-model:value="danmakuWindow.danmakuWindowSetting.animationDuration"
                    :min="0" :max="1000" :step="50"
                  >
                    <template #suffix>
                      ms
                    </template>
                  </NInputNumber>
                </NFormItem>
              </NFlex>
            </NCard>

            <NCard title="数量与消失" size="small" bordered>
              <NFlex vertical :size="4">
                <NFormItem label="最大弹幕数量" label-placement="left">
                  <NInputNumber
                    v-model:value="danmakuWindow.danmakuWindowSetting.maxDanmakuCount"
                    :min="10" :max="200"
                  />
                </NFormItem>
                <NFormItem label="自动消失时间" label-placement="left">
                  <NInputNumber
                    v-model:value="danmakuWindow.danmakuWindowSetting.autoDisappearTime"
                    :min="0" :max="600" :step="5"
                  >
                    <template #suffix>
                      秒
                    </template>
                  </NInputNumber>
                </NFormItem>
                <NText depth="3" style="font-size: 12px">
                  {{ danmakuWindow.danmakuWindowSetting.autoDisappearTime > 0 ? `弹幕将在 ${danmakuWindow.danmakuWindowSetting.autoDisappearTime} 秒后自动消失` : '设为 0 则弹幕不会自动消失' }}
                </NText>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 高级 -->
        <NTabPane name="advanced" tab="高级">
          <NFlex vertical :size="12">
            <NCard title="调试" size="small" bordered>
              <NFlex :size="8" wrap>
                <NButton size="small" type="info" @click="danmakuWindow.sendTestDanmaku()">
                  发送测试弹幕
                </NButton>
                <NButton size="small" type="warning" @click="danmakuWindow.clearAllDanmaku()">
                  清空弹幕
                </NButton>
              </NFlex>
            </NCard>

            <NCard title="表情数据" size="small" bordered>
              <NFlex align="center" justify="space-between">
                <NText depth="3" style="font-size: 12px">
                  Inline: {{ Object.keys(danmakuWindow.emojiData.data.inline).length }} 个 /
                  Plain: {{ Object.keys(danmakuWindow.emojiData.data.plain).length }} 个
                </NText>
                <NButton
                  size="small"
                  @click="async () => { await danmakuWindow.getEmojiData(); message.success('表情数据已重新加载') }"
                >
                  重新加载
                </NButton>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>
      </NTabs>
    </NCard>
  </NFlex>
</template>

<style scoped>
.n-form-item {
  margin-bottom: 4px;
}
</style>
