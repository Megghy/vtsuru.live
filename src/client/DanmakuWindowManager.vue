<script setup lang="ts">
import { NAlert, NButton, NCard, NCheckbox, NCheckboxGroup, NColorPicker, NDivider, NFlex, NForm, NFormItem, NGi, NGrid, NIcon, NInputNumber, NRadioButton, NRadioGroup, NSelect, NSlider, NSpace, NSwitch, NTabPane, NTabs, NText, useMessage } from 'naive-ui';
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useDanmakuWindow } from './store/useDanmakuWindow';

import {
  ResizeTable24Filled
} from '@vicons/fluent';

const danmakuWindow = useDanmakuWindow();
const message = useMessage();
const route = useRoute();

const isSettingPositionMode = ref(false);
const isLoading = ref(false);

// 计算属性，类型映射
const filterTypeOptions = [
  { label: '弹幕消息', value: 'Message' },
  { label: '礼物', value: 'Gift' },
  { label: 'SC', value: 'SC' },
  { label: '舰长', value: 'Guard' },
  { label: '进场', value: 'Enter' }
];

// 分组预设
const presets = {
  dark: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    textColor: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.7)'
  },
  light: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    textColor: '#333333',
    shadowColor: 'rgba(0,0,0,0.2)'
  },
  transparent: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    textColor: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.0)'
  }
};

// 自动消失时间选项
const autoDisappearOptions = [
  { label: '不自动消失', value: 0 },
  { label: '10秒', value: 10 },
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '3分钟', value: 180 },
  { label: '5分钟', value: 300 },
];

// 应用预设
function applyPreset(preset: 'dark' | 'light' | 'transparent') {
  const presetData = presets[preset];
  danmakuWindow.danmakuWindowSetting.backgroundColor = presetData.backgroundColor;
  danmakuWindow.danmakuWindowSetting.textColor = presetData.textColor;
  danmakuWindow.danmakuWindowSetting.shadowColor = presetData.shadowColor;
  message.success(`已应用${preset === 'dark' ? '暗黑' : preset === 'light' ? '明亮' : '透明'}主题预设`);
}

// 重置位置到屏幕中央
  async function resetPosition() {
  console.log(danmakuWindow.danmakuWindowSetting.height)
  danmakuWindow.setDanmakuWindowPosition(0, 0);
  message.success('窗口位置已重置');
}

// 新增：弹幕展示风格选项
const displayStyleOptions = [
  { label: '卡片风格', value: 'card' },
  { label: '纯文本风格', value: 'text' }
];

// 新增：分隔符选项
const separatorOptions = [
  { label: ': (冒号+空格)', value: ': ' },
  { label: '：(中文冒号)', value: '：' },
  { label: '> ', value: '> ' },
  { label: '| ', value: '| ' },
  { label: '- ', value: '- ' },
  { label: '→ ', value: '→ ' },
];
</script>

<template>
  <NCard
    title="弹幕窗口管理"
    bordered
  >
    <template #header-extra>
      <NButton
        :type="danmakuWindow.isDanmakuWindowOpen ? 'warning' : 'primary'"
        @click="danmakuWindow.isDanmakuWindowOpen ? danmakuWindow.closeWindow() : danmakuWindow.openWindow()"
      >
        {{ danmakuWindow.isDanmakuWindowOpen ? '关闭弹幕窗口' : '打开弹幕窗口' }}
      </NButton>
    </template>

    <NFlex
      vertical
      :size="20"
    >
      <NAlert
        v-if="!danmakuWindow.isDanmakuWindowOpen"
        title="弹幕窗口未打开"
        type="info"
      >
        请先打开弹幕窗口后再进行设置
      </NAlert>

      <NTabs
        type="line"
        animated
      >
        <NTabPane
          name="position"
          tab="布局与位置"
        >
          <NFlex vertical>
            <NForm
              label-placement="left"
              label-width="100"
            >
              <NGrid
                :cols="2"
                :x-gap="12"
              >
                <NGi>
                  <NFormItem label="窗口宽度">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.width"
                      :min="200"
                      :max="2000"
                      @update:value="(value) => danmakuWindow.setDanmakuWindowSize(value as number, danmakuWindow.danmakuWindowSetting.height)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="窗口高度">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.height"
                      :min="200"
                      :max="2000"
                      @update:value="(value) => danmakuWindow.setDanmakuWindowSize(danmakuWindow.danmakuWindowSetting.width, value as number)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="X位置">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.x"
                      :min="0"
                      @update:value="() => danmakuWindow.updateWindowPosition()"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="Y位置">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.y"
                      :min="0"
                      @update:value="() => danmakuWindow.updateWindowPosition()"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
            </NForm>
            <NDivider />
            <NFlex
              justify="space-between"
              align="center"
            >
              <NButton
                secondary
                @click="resetPosition"
              >
                <template #icon>
                  <NIcon :component="ResizeTable24Filled" />
                </template>
                重置位置
              </NButton>
              <NSpace>
                <NFormItem label="总是置顶">
                  <NSwitch
                    v-model:value="danmakuWindow.danmakuWindowSetting.alwaysOnTop"
                  />
                </NFormItem>
                <NFormItem label="鼠标穿透">
                  <NSwitch
                    v-model:value="danmakuWindow.danmakuWindowSetting.interactive"
                  />
                </NFormItem>
              </NSpace>
            </NFlex>
          </NFlex>
        </NTabPane>

        <NTabPane
          name="appearance"
          tab="外观"
        >
          <NFlex vertical>
            <NGrid
              :cols="2"
              :x-gap="12"
            >
              <NGi>
                <NFormItem label="背景颜色">
                  <NColorPicker
                    v-model:value="danmakuWindow.danmakuWindowSetting.backgroundColor"
                    :show-alpha="true"
                  />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="文字颜色">
                  <NColorPicker
                    v-model:value="danmakuWindow.danmakuWindowSetting.textColor"
                    :show-alpha="true"
                  />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="透明度">
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.opacity"
                    :min="0.1"
                    :max="1"
                    :step="0.05"
                  />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="字体大小">
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.fontSize"
                    :min="10"
                    :max="24"
                    :step="1"
                  />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="圆角大小">
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.borderRadius"
                    :min="0"
                    :max="20"
                    :step="1"
                  />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="项目间距">
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.itemSpacing"
                    :min="0"
                    :max="20"
                    :step="1"
                  />
                </NFormItem>
              </NGi>
            </NGrid>

            <NFlex
              justify="space-between"
              align="center"
            >
              <NSpace>
                <NButton @click="applyPreset('dark')">
                  暗色主题
                </NButton>
                <NButton @click="applyPreset('light')">
                  亮色主题
                </NButton>
                <NButton @click="applyPreset('transparent')">
                  透明主题
                </NButton>
              </NSpace>
            </NFlex>
          </NFlex>
        </NTabPane>

        <NTabPane
          name="content"
          tab="内容设置"
        >
          <NGrid
            :cols="1"
          >
            <!-- 新增：弹幕展示风格 -->
            <NGi>
              <NFormItem label="展示风格">
                <NRadioGroup v-model:value="danmakuWindow.danmakuWindowSetting.displayStyle">
                  <NSpace>
                    <NRadioButton
                      v-for="option in displayStyleOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </NRadioButton>
                  </NSpace>
                </NRadioGroup>
              </NFormItem>
            </NGi>

            <!-- 其他内容设置 -->
            <NGi>
              <NFormItem label="信息显示">
                <NCheckboxGroup v-model:value="danmakuWindow.danmakuWindowSetting.filterTypes">
                  <NSpace>
                    <NCheckbox
                      v-for="option in filterTypeOptions"
                      :key="option.value"
                      :value="option.value"
                      :label="option.label"
                    />
                  </NSpace>
                </NCheckboxGroup>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="显示选项">
                <NSpace>
                  <NCheckbox
                    v-model:checked="danmakuWindow.danmakuWindowSetting.showAvatar"
                  >
                    显示头像
                  </NCheckbox>
                  <NCheckbox
                    v-model:checked="danmakuWindow.danmakuWindowSetting.showUsername"
                  >
                    显示用户名
                  </NCheckbox>
                  <NCheckbox
                    v-model:checked="danmakuWindow.danmakuWindowSetting.showFansMedal"
                  >
                    显示粉丝牌
                  </NCheckbox>
                  <NCheckbox
                    v-model:checked="danmakuWindow.danmakuWindowSetting.showGuardIcon"
                  >
                    显示舰长图标
                  </NCheckbox>
                </NSpace>
              </NFormItem>
            </NGi>

            <!-- 新增：纯文本风格特定设置 -->
            <NGi v-if="danmakuWindow.danmakuWindowSetting.displayStyle === 'text'">
              <NDivider>纯文本风格设置</NDivider>
              <NSpace vertical>
                <NFormItem label="紧凑布局">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.textStyleCompact" />
                  <NText
                    depth="3"
                    style="margin-left: 8px"
                  >
                    启用后减少边距，适合小窗口
                  </NText>
                </NFormItem>

                <NFormItem label="显示消息类型">
                  <NSwitch v-model:value="danmakuWindow.danmakuWindowSetting.textStyleShowType" />
                  <NText
                    depth="3"
                    style="margin-left: 8px"
                  >
                    显示【礼物】【SC】等类型标签
                  </NText>
                </NFormItem>

                <NFormItem label="用户名分隔符">
                  <NSelect
                    v-model:value="danmakuWindow.danmakuWindowSetting.textStyleNameSeparator"
                    :options="separatorOptions"
                    style="width: 160px"
                  />
                </NFormItem>
              </NSpace>
            </NGi>

            <NGi>
              <NDivider>弹幕行为</NDivider>
            </NGi>

            <NGi>
              <NFormItem label="弹幕方向">
                <NSpace align="center">
                  <NText>从上往下</NText>
                  <NSwitch
                    v-model:value="danmakuWindow.danmakuWindowSetting.reverseOrder"
                  />
                  <NText>从下往上</NText>
                </NSpace>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="最大弹幕数量">
                <NInputNumber
                  v-model:value="danmakuWindow.danmakuWindowSetting.maxDanmakuCount"
                  :min="10"
                  :max="200"
                />
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="动画持续时间">
                <NInputNumber
                  v-model:value="danmakuWindow.danmakuWindowSetting.animationDuration"
                  :min="0"
                  :max="1000"
                  :step="50"
                >
                  <template #suffix>
                    ms
                  </template>
                </NInputNumber>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="自动消失时间">
                <NSpace vertical>
                  <NSlider
                    v-model:value="danmakuWindow.danmakuWindowSetting.autoDisappearTime"
                    :min="0"
                    :max="300"
                    :step="5"
                    :marks="{
                      0: '不消失',
                      60: '1分钟',
                      300: '5分钟'
                    }"
                  />
                  <NSpace justify="space-between">
                    <NButton
                      v-for="option in autoDisappearOptions"
                      :key="option.value"
                      size="small"
                      :type="danmakuWindow.danmakuWindowSetting.autoDisappearTime === option.value ? 'primary' : 'default'"
                      @click="danmakuWindow.danmakuWindowSetting.autoDisappearTime = option.value"
                    >
                      {{ option.label }}
                    </NButton>
                  </NSpace>
                  <NText
                    v-if="danmakuWindow.danmakuWindowSetting.autoDisappearTime > 0"
                    depth="3"
                  >
                    弹幕将在 {{ danmakuWindow.danmakuWindowSetting.autoDisappearTime }} 秒后自动消失
                  </NText>
                  <NText
                    v-else
                    depth="3"
                  >
                    弹幕不会自动消失
                  </NText>
                </NSpace>
              </NFormItem>
            </NGi>
          </NGrid>
        </NTabPane>

        <!-- 添加新的设置选项卡：高级设置 -->
        <NTabPane
          name="advanced"
          tab="高级设置"
        >
          <NGrid
            :cols="1"
            :y-gap="4"
          >
            <NGi>
              <NDivider>调试选项</NDivider>
              <NSpace vertical>
                <NButton
                  type="info"
                  @click="danmakuWindow.sendTestDanmaku && danmakuWindow.sendTestDanmaku()"
                >
                  发送测试弹幕
                </NButton>
                <NButton
                  type="warning"
                  @click="danmakuWindow.clearAllDanmaku && danmakuWindow.clearAllDanmaku()"
                >
                  清空弹幕
                </NButton>
                <NFlex>
                  <NText>
                    当前表情数据:
                    Inline: {{ Object.keys(danmakuWindow.emojiData.data.inline).length }} 个
                    <br>
                    Plain: {{ Object.keys(danmakuWindow.emojiData.data.plain).length }} 个
                  </NText>
                  <NButton
                    @click="async () => {
                      await danmakuWindow.getEmojiData()
                      message.success('表情数据已重新加载')
                    }"
                  >
                    <template #icon>
                      <NIcon :component="ResizeTable24Filled" />
                    </template>
                    重新加载表情数据
                  </NButton>
                </NFlex>
              </NSpace>
            </NGi>
          </NGrid>
        </NTabPane>
      </NTabs>
    </NFlex>
  </NCard>
</template>

<style scoped>
.n-form-item {
  margin-bottom: 8px;
}

.position-indicator {
  position: fixed;
  pointer-events: none;
  border: 2px dashed #f56c6c;
  z-index: 9999;
  background-color: rgba(245, 108, 108, 0.1);
}

/* 添加一些美化样式 */
:deep(.n-tabs-tab) {
  padding: 12px 20px;
}

:deep(.n-divider) {
  margin: 12px 0;
}

.n-alert {
  margin-bottom: 16px;
}

:deep(.n-slider) {
  width: 100%;
  max-width: 500px;
}
</style>
