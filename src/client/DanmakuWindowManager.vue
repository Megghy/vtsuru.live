<script setup lang="ts">
import { useDanmakuWindow } from './store/useDanmakuWindow';
import { useRoute } from 'vue-router';
import { EventDataTypes } from '@/api/api-models';
import { useMessage } from 'naive-ui';
import { ref, computed } from 'vue';
import {
  NButton, NCard, NSpace, NSlider, NSwitch, NSelect, NInputNumber,
  NColorPicker, NDivider, NGrid, NGi, NFlex, NCheckbox, NCheckboxGroup,
  NIcon, NTooltip, NSpin, NText, NAlert, NTabs, NTabPane, NForm, NFormItem
} from 'naive-ui';

import {
  DesktopMac24Regular,
  TextFont24Regular,
  ColorFill24Regular,
  AppsList24Regular,
  DesignIdeas24Regular,
  CheckmarkCircle24Regular,
  ResizeTable24Filled,
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

// 应用预设
function applyPreset(preset: 'dark' | 'light' | 'transparent') {
  const presetData = presets[preset];
  danmakuWindow.updateSetting('backgroundColor', presetData.backgroundColor);
  danmakuWindow.updateSetting('textColor', presetData.textColor);
  danmakuWindow.updateSetting('shadowColor', presetData.shadowColor);
  message.success(`已应用${preset === 'dark' ? '暗黑' : preset === 'light' ? '明亮' : '透明'}主题预设`);
}

// 重置位置到屏幕中央
async function resetPosition() {
  // 假设屏幕尺寸为 1920x1080，将窗口居中
  const width = danmakuWindow.danmakuWindowSetting.width;
  const height = danmakuWindow.danmakuWindowSetting.height;

  // 计算居中位置
  const x = Math.floor((1920 - width) / 2);
  const y = Math.floor((1080 - height) / 2);

  danmakuWindow.setDanmakuWindowPosition(x, y);
  message.success('窗口位置已重置');
}

// 更新设置，包装了updateSetting方法
function updateSetting<K extends keyof typeof danmakuWindow.danmakuWindowSetting>(
  key: K,
  value: typeof danmakuWindow.danmakuWindowSetting[K]
) {
  danmakuWindow.updateSetting(key, value);
}
</script>

<template>
  <NCard
    title="弹幕窗口管理"
    bordered
  >
    <template #header-extra>
      <NButton
        :type="danmakuWindow.isDanmakuWindowOpen ? 'warning' : 'primary'"
        @click="danmakuWindow.isDanmakuWindowOpen ? danmakuWindow.closeWindow() : danmakuWindow.createWindow()"
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
                      @update:value="val => updateSetting('width', val || 400)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="窗口高度">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.height"
                      :min="200"
                      :max="2000"
                      @update:value="val => updateSetting('height', val || 600)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="X位置">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.x"
                      :min="0"
                      @update:value="val => updateSetting('x', val || 0)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="Y位置">
                    <NInputNumber
                      v-model:value="danmakuWindow.danmakuWindowSetting.y"
                      :min="0"
                      @update:value="val => updateSetting('y', val || 0)"
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
                    @update:value="val => updateSetting('alwaysOnTop', val)"
                  />
                </NFormItem>
                <NFormItem label="鼠标穿透">
                  <NSwitch
                    v-model:value="danmakuWindow.danmakuWindowSetting.interactive"
                    @update:value="val => updateSetting('interactive', val)"
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
              :y-gap="12"
            >
              <NGi>
                <NFormItem label="背景颜色">
                  <NColorPicker
                    v-model:value="danmakuWindow.danmakuWindowSetting.backgroundColor"
                    :show-alpha="true"
                    @update:value="val => updateSetting('backgroundColor', val)"
                  />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="文字颜色">
                  <NColorPicker
                    v-model:value="danmakuWindow.danmakuWindowSetting.textColor"
                    :show-alpha="true"
                    @update:value="val => updateSetting('textColor', val)"
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
                    @update:value="val => updateSetting('opacity', val)"
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
                    @update:value="val => updateSetting('fontSize', val)"
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
                    @update:value="val => updateSetting('borderRadius', val)"
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
                    @update:value="val => updateSetting('itemSpacing', val)"
                  />
                </NFormItem>
              </NGi>
            </NGrid>

            <NFlex
              justify="space-between"
              align="center"
            >
              <NSpace>
                <NFormItem label="启用阴影">
                  <NSwitch
                    v-model:value="danmakuWindow.danmakuWindowSetting.enableShadow"
                    @update:value="val => updateSetting('enableShadow', val)"
                  />
                </NFormItem>
                <NFormItem
                  v-if="danmakuWindow.danmakuWindowSetting.enableShadow"
                  label="阴影颜色"
                >
                  <NColorPicker
                    v-model:value="danmakuWindow.danmakuWindowSetting.shadowColor"
                    :show-alpha="true"
                    @update:value="val => updateSetting('shadowColor', val)"
                  />
                </NFormItem>
              </NSpace>

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
            :y-gap="12"
          >
            <NGi>
              <NFormItem label="信息显示">
                <NCheckboxGroup v-model:value="danmakuWindow.danmakuWindowSetting.filterTypes">
                  <NSpace>
                    <NCheckbox
                      v-for="option in filterTypeOptions"
                      :key="option.value"
                      :value="option.value"
                      :label="option.label"
                      @update:checked="val => {
                        let types = [...danmakuWindow.danmakuWindowSetting.filterTypes];
                        if (val) {
                          if (!types.includes(option.value)) types.push(option.value);
                        } else {
                          types = types.filter(t => t !== option.value);
                        }
                        updateSetting('filterTypes', types);
                      }"
                    />
                  </NSpace>
                </NCheckboxGroup>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="显示选项">
                <NSpace>
                  <NCheckbox
                    :checked="danmakuWindow.danmakuWindowSetting.showAvatar"
                    @update:checked="val => updateSetting('showAvatar', val)"
                  >
                    显示头像
                  </NCheckbox>
                  <NCheckbox
                    :checked="danmakuWindow.danmakuWindowSetting.showUsername"
                    @update:checked="val => updateSetting('showUsername', val)"
                  >
                    显示用户名
                  </NCheckbox>
                  <NCheckbox
                    :checked="danmakuWindow.danmakuWindowSetting.showFansMedal"
                    @update:checked="val => updateSetting('showFansMedal', val)"
                  >
                    显示粉丝牌
                  </NCheckbox>
                  <NCheckbox
                    :checked="danmakuWindow.danmakuWindowSetting.showGuardIcon"
                    @update:checked="val => updateSetting('showGuardIcon', val)"
                  >
                    显示舰长图标
                  </NCheckbox>
                </NSpace>
              </NFormItem>
            </NGi>

            <NGi>
              <NFormItem label="弹幕方向">
                <NSpace align="center">
                  <NText>从上往下</NText>
                  <NSwitch
                    v-model:value="danmakuWindow.danmakuWindowSetting.reverseOrder"
                    @update:value="val => updateSetting('reverseOrder', val)"
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
                  @update:value="val => updateSetting('maxDanmakuCount', val || 50)"
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
                  @update:value="val => updateSetting('animationDuration', val || 300)"
                >
                  <template #suffix>
                    ms
                  </template>
                </NInputNumber>
              </NFormItem>
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
</style>
