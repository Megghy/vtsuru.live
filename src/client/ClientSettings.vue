<script setup lang="ts">
  import { useColorMode } from '@vueuse/core';
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
  import { ref, watch, onMounted } from 'vue';
  import {
    NGrid,
    NGridItem,
    NMenu,
    NRadio,
    NRadioGroup,
    NSwitch,
    NSpace,
    NCard,
    NSpin,
    NFormItem,
    NAlert,
    NCheckboxGroup,
    NCheckbox,
    NDivider,
  } from 'naive-ui';
  import type { MenuOption } from 'naive-ui';
  import { ThemeType } from '@/api/api-models';
  import { NotificationType, useSettings } from './store/useSettings';
  import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';

  // --- State ---

  const currentTab = ref('general');
  const isLoading = ref(true);
  const errorMsg = ref<string | null>(null);
  const titleClickCount = ref(0); // 添加计数器状态变量
  let resetTimeout: number | null = null; // 用于重置计数器的超时ID

  const setting = useSettings();
  const currentVersion = await getVersion();

  // Navigation
  const navOptions: MenuOption[] = [
    { label: '常规', key: 'general' },
    { label: '通知', key: 'notification' },
    { label: '其他', key: 'other' },
    { label: '关于', key: 'about' },
  ];

  // Theme

  const themeType = useStorage('Settings.Theme', ThemeType.Auto);

  // Autostart Settings
  const isStartOnBoot = ref(false);
  const minimizeOnStart = ref(false);

  // --- Lifecycle Hooks ---

  onMounted(async () => {
    isLoading.value = true;
    errorMsg.value = null;
    try {
      isStartOnBoot.value = await isEnabled();
    } catch (err) {
      console.error("Failed to fetch autostart status:", err);
      errorMsg.value = "无法获取开机启动状态，请稍后重试。";
    } finally {
      isLoading.value = false;
    }
  });

  // --- Watchers for Side Effects ---

  watch(isStartOnBoot, async (newValue, oldValue) => {
    if (isLoading.value || newValue === oldValue) return;

    errorMsg.value = null;
    try {
      if (newValue) {
        await enable();
      } else {
        await disable();
      }
    } catch (err) {
      console.error("Failed to update autostart status:", err);
      errorMsg.value = `设置开机启动失败: ${err instanceof Error ? err.message : '未知错误'}`;
      isStartOnBoot.value = oldValue;
      window.$message.error('设置开机启动失败');
    }
  });

  const renderNotifidactionEnable = (name: NotificationType) => h(NCheckbox, {
    checked: setting.settings.notificationSettings?.enableTypes.includes(name),
    onUpdateChecked: (value) => {
      setting.settings.notificationSettings.enableTypes ??= [];
      if (value) {
        setting.settings.notificationSettings.enableTypes.push(name);
      } else {
        setting.settings.notificationSettings.enableTypes = setting.settings.notificationSettings.enableTypes.filter(type => type !== name);
      }
    },
  }, () => '启用');

  // --- 隐藏功能处理函数 ---
  const handleTitleClick = () => {
    titleClickCount.value++;

    if (resetTimeout !== null) {
      clearTimeout(resetTimeout);
    }

    resetTimeout = setTimeout(() => {
      titleClickCount.value = 0;
    }, 3000) as unknown as number;

    if (titleClickCount.value === 10) {
      invoke('open_dev_tools')
        .then(() => {
          window.$message.success('已打开 Dev Tools');
        })
    }
  };
</script>

<template>
  <NSpace
    vertical
    size="large"
  >
    <!-- Increased spacing -->
    <!-- 标题区域 -->
    <div style="max-width: 72rem; margin: 0 auto; padding: 0 1rem;">
      <!-- Added padding -->
      <h1
        style="font-size: 1.875rem; font-weight: 600; margin-bottom: 1rem;"
        @click="handleTitleClick"
      >
        <!-- Added margin -->
        设置
      </h1>
    </div>

    <!-- 布局区域 -->
    <NGrid
      cols="24"
      item-responsive
      responsive="screen"
    >
      <!-- Left Navigation -->
      <NGridItem span="6">
        <NMenu
          v-model:value="currentTab"
          :options="navOptions"
          :indent="18"
        />
      </NGridItem>

      <!-- Right Content Area -->
      <NGridItem span="18">
        <NSpin :show="isLoading">
          <NSpace
            vertical
            size="large"
          >
            <NAlert
              v-if="errorMsg"
              title="操作错误"
              type="error"
              closable
              @close="errorMsg = null"
            >
              {{ errorMsg }}
            </NAlert>

            <Transition
              name="fade"
              mode="out-in"
            >
              <div :key="currentTab">
                <template v-if="currentTab === 'general'">
                  <NSpace vertical>
                    <NCard
                      title="启动"
                      :bordered="false"
                    >
                      <NFlex
                        vertical
                        align="start"
                      >
                        <LabelItem
                          label="开机时启动应用"
                          label-placement="left"
                        >
                          <NSwitch
                            v-model:value="isStartOnBoot"
                            :disabled="isLoading"
                          />
                        </LabelItem>
                        <LabelItem
                          v-if="isStartOnBoot"
                          label="启动后最小化到托盘"
                          label-placement="left"
                        >
                          <NSwitch
                            v-model:value="setting.settings.bootAsMinimized"
                            @update:value="setting.save()"
                          />
                        </LabelItem>
                      </NFlex>
                    </NCard>

                    <NCard
                      title="外观"
                      :bordered="false"
                    >
                      <NFormItem
                        label="主题模式"
                        label-placement="left"
                      >
                        <NRadioGroup
                          v-model:value="themeType"
                          name="theme-mode"
                          :segmented="true"
                        >
                          <NRadio :value="ThemeType.Light">
                            亮色
                          </NRadio>
                          <NRadio :value="ThemeType.Dark">
                            暗色
                          </NRadio>
                          <NRadio :value="ThemeType.Auto">
                            跟随系统
                          </NRadio>
                        </NRadioGroup>
                      </NFormItem>
                    </NCard>
                  </NSpace>
                </template>

                <template v-else-if="currentTab === 'notification'">
                  <NCard
                    title="通知设置"
                    :bordered="false"
                  >
                    <NAlert type="warning">
                      未完全完成
                    </NAlert>
                    <NDivider />
                    <NSpace vertical>
                      <NCheckbox
                        v-model:checked="setting.settings.enableNotification"
                        @update:checked="(value) => {
                          setting.save();
                        }"
                      >
                        启用通知
                      </NCheckbox>

                      <template v-if="setting.settings.enableNotification">
                        <NCard
                          size="small"
                          title="提问箱通知"
                        >
                          <template #header-extra>
                            <component :is="renderNotifidactionEnable('question-box')" />
                          </template>
                        </NCard>
                        <NCard
                          size="small"
                          title="积分兑换通知"
                        >
                          <template #header-extra>
                            <component :is="renderNotifidactionEnable('goods-buy')" />
                          </template>
                        </NCard>
                        <NCard
                          size="small"
                          title="弹幕相关"
                        >
                          <template #header-extra>
                            <component :is="renderNotifidactionEnable('danmaku')" />
                          </template>
                        </NCard>
                      </template>
                    </NSpace>
                  </NCard>
                </template>

                <template v-else-if="currentTab === 'other'">
                  <NCard
                    title="其他设置"
                    :bordered="false"
                  >
                    <p>其他设置将显示在这里。</p>
                  </NCard>
                </template>

                <template v-else-if="currentTab === 'about'">
                  <NCard
                    title="关于"
                    :bordered="false"
                  >
                    <template #header-extra>
                      <div
                        style="width: 10px; height: 10px;"
                        @click="$router.push({ name: 'client-test' })"
                      />
                    </template>
                    <p>VTsuruEventFetcher Tauri</p>
                    <p>版本: {{ currentVersion }}</p>
                    <p>
                      作者:
                      <NButton
                        tag="a"
                        href="https://space.bilibili.com/10021741"
                        target="_blank"
                        type="info"
                        text
                      >
                        Megghy
                      </NButton>
                    </p>
                    <p>
                      储存库:
                      <NButton
                        tag="a"
                        href="https://github.com/Megghy/vtsuru.live/tree/master/src/client"
                        target="_blank"
                        type="info"
                        text
                      >
                        界面/逻辑
                      </NButton>
                      <NDivider vertical />
                      <NButton
                        tag="a"
                        href="https://github.com/Megghy/vtsuru-fetcher-client"
                        target="_blank"
                        type="info"
                        text
                      >
                        Tauri 客户端
                      </NButton>
                    </p>
                    <p>
                      反馈: 🐧 873260337
                    </p>
                  </NCard>
                </template>
              </div>
            </Transition>
          </NSpace>
          <template #description>
            正在加载设置...
          </template>
        </NSpin>
      </NGridItem>
    </NGrid>
  </NSpace>
</template>

<style scoped>

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }

  .label-item {
    height: 20px;
  }
</style>