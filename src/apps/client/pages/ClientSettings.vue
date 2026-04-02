<script setup lang="ts">
import type { MenuOption } from 'naive-ui'
import type { NotificationType } from '@/apps/client/store/useSettings'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import {
  NAlert, NCard, NCheckbox, NDivider, NFormItem, NGrid, NGridItem, NMenu, NRadio, NRadioGroup, NSpin, NSwitch } from 'naive-ui';
import { onMounted, ref, watch } from 'vue'
import { ThemeType } from '@/api/api-models'
import { useSettings } from '@/apps/client/store/useSettings'
import ClientBackupPanel from '@/apps/client/components/settings/ClientBackupPanel.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import { usePersistedStorage } from '@/shared/storage/persist'

// --- State ---

const currentTab = ref('general')
const isLoading = ref(true)
const errorMsg = ref<string | null>(null)
const titleClickCount = ref(0) // 添加计数器状态变量
let resetTimeout: number | null = null // 用于重置计数器的超时ID

const setting = useSettings()
const currentVersion = await getVersion()

// 更新检查
const isCheckingUpdate = ref(false)
const handleCheckUpdate = async () => {
  isCheckingUpdate.value = true
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    
    if (update) {
      window.$message.info(`发现新版本 ${update.version}，正在下载更新...`)
      
      // 下载并安装更新
      await update.downloadAndInstall()
      
      window.$message.success('更新已下载，重启应用以完成更新')
      
      // 询问是否立即重启
      const { relaunch } = await import('@tauri-apps/plugin-process')
      setTimeout(() => relaunch(), 2000)
    } else {
      window.$message.success('当前已是最新版本')
    }
  }
  catch (err: any) {
    console.error('检查更新失败:', err)
    window.$message.error(`检查更新失败: ${err}`)
  }
  finally {
    isCheckingUpdate.value = false
  }
}

// Navigation
const navOptions: MenuOption[] = [
  { label: '常规', key: 'general' },
  { label: '通知', key: 'notification' },
  { label: '备份', key: 'backup' },
  { label: '其他', key: 'other' },
  { label: '关于', key: 'about' },
]

// Theme

const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)

// Autostart Settings
const isStartOnBoot = ref(false)

// --- Lifecycle Hooks ---

onMounted(async () => {
  isLoading.value = true
  errorMsg.value = null
  try {
    isStartOnBoot.value = await isEnabled()
  } catch (err) {
    console.error('Failed to fetch autostart status:', err)
    errorMsg.value = '无法获取开机启动状态，请稍后重试。'
  } finally {
    isLoading.value = false
  }
})

// --- Watchers for Side Effects ---

watch(isStartOnBoot, async (newValue, oldValue) => {
  if (isLoading.value || newValue === oldValue) return

  errorMsg.value = null
  try {
    if (newValue) {
      await enable()
    } else {
      await disable()
    }
  } catch (err) {
    console.error('Failed to update autostart status:', err)
    errorMsg.value = `设置开机启动失败: ${err instanceof Error ? err.message : '未知错误'}`
    isStartOnBoot.value = oldValue
    window.$message.error('设置开机启动失败')
  }
})

function renderNotifidactionEnable(name: NotificationType) {
  return h(NCheckbox, {
    checked: setting.settings.notificationSettings?.enableTypes.includes(name),
    onUpdateChecked: (value) => {
      setting.settings.notificationSettings.enableTypes ??= []
      if (value) {
        setting.settings.notificationSettings.enableTypes.push(name)
      } else {
        setting.settings.notificationSettings.enableTypes = setting.settings.notificationSettings.enableTypes.filter(type => type !== name)
      }
    },
  }, () => '启用')
}

// --- 隐藏功能处理函数 ---
function handleTitleClick() {
  titleClickCount.value++

  if (resetTimeout !== null) {
    clearTimeout(resetTimeout)
  }

  resetTimeout = setTimeout(() => {
    titleClickCount.value = 0
  }, 3000) as unknown as number

  if (titleClickCount.value === 10) {
    invoke('open_dev_tools')
      .then(() => {
        window.$message.success('已打开 Dev Tools')
      })
  }
}
</script>

<template>
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <ClientPageHeader>
        <template #title>
          <NText strong @click="handleTitleClick">
            设置
          </NText>
        </template>
        <template #description>
          客户端行为、外观与通知偏好
        </template>
      </ClientPageHeader>
    </NCard>

    <NGrid
      cols="24"
      item-responsive
      responsive="screen"
      :x-gap="12"
      :y-gap="12"
    >
      <NGridItem span="24 900:6">
        <NCard size="small" bordered content-style="padding: 0;">
          <NMenu
            v-model:value="currentTab"
            :options="navOptions"
            :indent="18"
          />
        </NCard>
      </NGridItem>

      <NGridItem span="24 900:18">
        <NSpin :show="isLoading">
          <NFlex vertical :size="12">
            <NAlert
              v-if="errorMsg"
              title="操作错误"
              type="error"
              size="small"
              closable
              @close="errorMsg = null"
            >
              {{ errorMsg }}
            </NAlert>

            <Transition name="fade" mode="out-in">
              <div :key="currentTab">
                <template v-if="currentTab === 'general'">
                  <NFlex vertical :size="12">
                    <NCard title="启动" size="small" bordered>
                      <NFlex vertical :size="8" align="start">
                        <LabelItem label="开机时启动应用" label-placement="left">
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

                    <NCard title="外观" size="small" bordered>
                      <NFormItem label="主题模式" label-placement="left">
                        <NRadioGroup
                          v-model:value="themeType"
                          name="theme-mode"
                          :segmented="true"
                          size="small"
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
                  </NFlex>
                </template>

                <template v-else-if="currentTab === 'notification'">
                  <NCard title="通知" size="small" bordered>
                    <NAlert type="warning" size="small" :bordered="false">
                      未完全完成
                    </NAlert>
                    <NDivider />
                    <NFlex vertical :size="12">
                      <NCheckbox
                        v-model:checked="setting.settings.enableNotification"
                        @update:checked="() => setting.save()"
                      >
                        启用通知
                      </NCheckbox>

                      <template v-if="setting.settings.enableNotification">
                        <NCard size="small" bordered title="提问箱通知">
                          <template #header-extra>
                            <component :is="renderNotifidactionEnable('question-box')" />
                          </template>
                        </NCard>
                        <NCard size="small" bordered title="积分兑换通知">
                          <template #header-extra>
                            <component :is="renderNotifidactionEnable('goods-buy')" />
                          </template>
                        </NCard>
                        <NCard size="small" bordered title="弹幕相关">
                          <template #header-extra>
                            <component :is="renderNotifidactionEnable('danmaku')" />
                          </template>
                        </NCard>
                        <NCard size="small" bordered title="私信失败通知">
                          <template #header-extra>
                            <component :is="renderNotifidactionEnable('message-failed')" />
                          </template>
                          <NText depth="3">
                            当 B 站私信发送失败时通知你
                          </NText>
                        </NCard>
                        <NCard size="small" bordered title="弹幕发送失败通知">
                          <template #header-extra>
                            <component :is="renderNotifidactionEnable('live-danmaku-failed')" />
                          </template>
                          <NText depth="3">
                            当直播弹幕发送失败时通知你
                          </NText>
                        </NCard>
                      </template>
                    </NFlex>
                  </NCard>
                </template>

                <template v-else-if="currentTab === 'backup'">
                  <NCard title="备份" size="small" bordered>
                    <ClientBackupPanel />
                  </NCard>
                </template>

                <template v-else-if="currentTab === 'other'">
                  <NCard title="其他" size="small" bordered>
                    <NText depth="3">
                      其他设置将显示在这里。
                    </NText>
                  </NCard>
                </template>

                <template v-else-if="currentTab === 'about'">
                  <NCard title="关于" size="small" bordered>
                    <template #header-extra>
                      <div
                        style="width: 10px; height: 10px;"
                        @click="$router.push({ name: 'client-test' })"
                      />
                    </template>
                    <NFlex vertical :size="8">
                      <NText depth="3">
                        VTsuruEventFetcher Tauri
                      </NText>
                      <NText depth="3">
                        版本: {{ currentVersion }}
                      </NText>
                      <div>
                        <NText depth="3">
                          作者:
                        </NText>
                        <NButton
                          tag="a"
                          href="https://space.bilibili.com/10021741"
                          target="_blank"
                          type="info"
                          text
                        >
                          Megghy
                        </NButton>
                      </div>
                      <div>
                        <NText depth="3">
                          仓库:
                        </NText>
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
                      </div>
                      <NText depth="3">
                        反馈: 🐧 873260337
                      </NText>
                      <NDivider />
                      <NFlex align="center" justify="space-between">
                        <NText>检查更新</NText>
                        <NButton
                          size="small"
                          :loading="isCheckingUpdate"
                          @click="handleCheckUpdate"
                        >
                          检查更新
                        </NButton>
                      </NFlex>
                    </NFlex>
                  </NCard>
                </template>
              </div>
            </Transition>
          </NFlex>
          <template #description>
            正在加载设置...
          </template>
        </NSpin>
      </NGridItem>
    </NGrid>
  </NFlex>
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
</style>
