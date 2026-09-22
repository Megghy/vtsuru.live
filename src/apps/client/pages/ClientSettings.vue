<script setup lang="ts">
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import {
  Alert24Filled,
  ArrowSync24Regular,
  Info24Filled,
  Save24Filled,
  Settings24Filled,
} from '@vicons/fluent'
import type { MenuOption } from 'naive-ui'
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NFlex,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NMenu,
  NRadio,
  NRadioGroup,
  NSpin,
  NSwitch,
  NTag,
  NText,
} from 'naive-ui'
import { h, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ThemeType } from '@/api/api-models'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import ClientBackupPanel from '@/apps/client/components/settings/ClientBackupPanel.vue'
import type { NotificationType } from '@/apps/client/store/useSettings'
import { useSettings } from '@/apps/client/store/useSettings'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useWebFetcher } from '@/store/useWebFetcher'

// --- State ---

const route = useRoute()
const router = useRouter()
if (route.query.tab === 'transcription') void router.replace({ name: 'client-transcription' })
const currentTab = ref(route.query.tab === 'transcription' ? 'general' : (route.query.tab as string) || 'general')
const isLoading = ref(true)
const errorMsg = ref<string | null>(null)
const titleClickCount = ref(0)
let resetTimeout: number | null = null

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
      setTimeout(() => {
        void useWebFetcher()
          .Stop()
          .catch((err) => console.warn('重启前停止 EventFetcher 失败:', err))
          .then(() => relaunch())
      }, 2000)
    } else {
      window.$message.success('当前已是最新版本')
    }
  } catch (err: any) {
    console.error('检查更新失败:', err)
    window.$message.error(`检查更新失败: ${err}`)
  } finally {
    isCheckingUpdate.value = false
  }
}

// Navigation Options
const navOptions: MenuOption[] = [
  {
    label: '常规设置',
    key: 'general',
    icon: () => h(NIcon, null, { default: () => h(Settings24Filled) }),
  },
  {
    label: '系统通知',
    key: 'notification',
    icon: () => h(NIcon, null, { default: () => h(Alert24Filled) }),
  },
  {
    label: '数据备份',
    key: 'backup',
    icon: () => h(NIcon, null, { default: () => h(Save24Filled) }),
  },
  {
    label: '关于程序',
    key: 'about',
    icon: () => h(NIcon, null, { default: () => h(Info24Filled) }),
  },
]

// Theme
const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)

// Autostart Settings
const isStartOnBoot = ref(false)
const isUpdatingAutostart = ref(false)

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
  isUpdatingAutostart.value = true
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
  } finally {
    isUpdatingAutostart.value = false
  }
})

const notificationItems: Array<{ type: NotificationType; title: string; desc: string }> = [
  {
    type: 'question-box',
    title: '提问箱新问题通知',
    desc: '当收到新的公开或匿名提问时在桌面提醒',
  },
  {
    type: 'goods-buy',
    title: '积分兑换通知',
    desc: '当有观众在积分商城兑换实物或虚拟商品时提醒',
  },
  {
    type: 'danmaku',
    title: '弹幕连接异常通知',
    desc: '当弹幕流中断或异常重连时在桌面提醒',
  },
  {
    type: 'message-failed',
    title: '私信发送失败通知',
    desc: '自动操作发送 B站私信失败时在桌面提醒',
  },
  {
    type: 'live-danmaku-failed',
    title: '直播弹幕发送失败通知',
    desc: '自动操作发送直播间弹幕失败时在桌面提醒',
  },
]

function isNotificationTypeEnabled(type: NotificationType): boolean {
  return setting.settings.notificationSettings?.enableTypes?.includes(type) ?? false
}

function toggleNotificationType(type: NotificationType, value: boolean) {
  setting.settings.notificationSettings ??= { enableTypes: [] }
  setting.settings.notificationSettings.enableTypes ??= []
  if (value) {
    if (!setting.settings.notificationSettings.enableTypes.includes(type)) {
      setting.settings.notificationSettings.enableTypes.push(type)
    }
  } else {
    setting.settings.notificationSettings.enableTypes = setting.settings.notificationSettings.enableTypes.filter(
      (t) => t !== type,
    )
  }
  setting.save()
}

// --- 隐藏开发者功能 ---
function handleTitleClick() {
  titleClickCount.value++

  if (resetTimeout !== null) {
    clearTimeout(resetTimeout)
  }

  resetTimeout = setTimeout(() => {
    titleClickCount.value = 0
  }, 3000) as unknown as number

  if (titleClickCount.value === 10) {
    invoke('open_dev_tools').then(() => {
      window.$message.success('已打开 Dev Tools')
    })
  }
}
</script>

<template>
  <NFlex
    vertical
    :size="14"
    class="client-readable"
  >
    <NCard
      size="small"
      bordered
    >
      <ClientPageHeader>
        <template #title>
          <NText
            strong
            style="cursor: pointer;"
            @click="handleTitleClick"
          >
            客户端设置
          </NText>
        </template>
        <template #description>
          配置系统启动行为、界面外观、桌面通知与数据备份
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
      <!-- 左侧设置分类导航 -->
      <NGridItem span="24 900:6">
        <NCard
          size="small"
          bordered
          content-style="padding: 0;"
        >
          <NMenu
            v-model:value="currentTab"
            :options="navOptions"
            :indent="18"
          />
        </NCard>
      </NGridItem>

      <!-- 右侧设置内容 -->
      <NGridItem span="24 900:18">
        <NSpin :show="isLoading">
          <NFlex
            vertical
            :size="12"
          >
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

            <Transition
              name="fade"
              mode="out-in"
            >
              <div :key="currentTab">
                <!-- 常规设置 -->
                <template v-if="currentTab === 'general'">
                  <NFlex
                    vertical
                    :size="12"
                  >
                    <NCard
                      title="启动偏好"
                      size="small"
                      bordered
                    >
                      <NFlex
                        vertical
                        :size="12"
                        align="start"
                      >
                        <LabelItem
                          label="开机时自动启动应用"
                          label-placement="left"
                        >
                          <NSwitch
                            v-model:value="isStartOnBoot"
                            :disabled="isLoading || isUpdatingAutostart"
                            :loading="isUpdatingAutostart"
                          />
                        </LabelItem>

                        <LabelItem
                          v-if="isStartOnBoot"
                          label="启动后静默最小化到系统托盘"
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
                      title="界面外观"
                      size="small"
                      bordered
                    >
                      <NFormItem
                        label="主题模式"
                        label-placement="left"
                      >
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

                <!-- 系统通知 -->
                <template v-else-if="currentTab === 'notification'">
                  <NCard
                    title="系统通知"
                    size="small"
                    bordered
                  >
                    <NFlex
                      vertical
                      :size="14"
                    >
                      <div class="notification-master-row">
                        <div>
                          <NText strong>
                            桌面通知总开关
                          </NText>
                          <div class="setting-hint">
                            开启后，选中的事件将在 Windows 桌面右下角推送通知
                          </div>
                        </div>
                        <NSwitch
                          v-model:value="setting.settings.enableNotification"
                          @update:value="() => setting.save()"
                        />
                      </div>

                      <NDivider style="margin: 4px 0;" />

                      <div
                        v-if="setting.settings.enableNotification"
                        class="notification-list"
                      >
                        <div
                          v-for="item in notificationItems"
                          :key="item.type"
                          class="notification-row"
                        >
                          <div class="notification-text">
                            <NText strong>
                              {{ item.title }}
                            </NText>
                            <div class="setting-hint">
                              {{ item.desc }}
                            </div>
                          </div>
                          <NSwitch
                            size="small"
                            :value="isNotificationTypeEnabled(item.type)"
                            @update:value="(val) => toggleNotificationType(item.type, val)"
                          />
                        </div>
                      </div>

                      <NText
                        v-else
                        depth="3"
                        style="text-align: center; padding: 12px;"
                      >
                        桌面通知已全局关闭
                      </NText>
                    </NFlex>
                  </NCard>
                </template>

                <!-- 数据备份 -->
                <template v-else-if="currentTab === 'backup'">
                  <NCard
                    title="数据备份"
                    size="small"
                    bordered
                  >
                    <ClientBackupPanel />
                  </NCard>
                </template>

                <!-- 关于程序 -->
                <template v-else-if="currentTab === 'about'">
                  <NCard
                    title="关于 VTsuru.Client"
                    size="small"
                    bordered
                  >
                    <NFlex
                      vertical
                      :size="14"
                    >
                      <div class="about-hero">
                        <div class="about-title-row">
                          <NText
                            strong
                            style="font-size: 16px;"
                          >
                            VTsuru EventFetcher
                          </NText>
                          <NTag
                            size="small"
                            type="info"
                            :bordered="false"
                            round
                          >
                            v{{ currentVersion }}
                          </NTag>
                        </div>
                        <NText depth="3">
                          专为 Bilibili 主播打造的现代化全功能直播辅助与事件采集桌面客户端
                        </NText>
                      </div>

                      <div class="about-meta-list">
                        <div class="about-meta-item">
                          <NText depth="3">
                            作者
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

                        <div class="about-meta-item">
                          <NText depth="3">
                            开源仓库
                          </NText>
                          <NFlex :size="8">
                            <NButton
                              tag="a"
                              href="https://github.com/Megghy/vtsuru.live"
                              target="_blank"
                              type="info"
                              text
                            >
                              Web 平台
                            </NButton>
                            <span style="opacity: 0.4;">/</span>
                            <NButton
                              tag="a"
                              href="https://github.com/Megghy/vtsuru-fetcher-client"
                              target="_blank"
                              type="info"
                              text
                            >
                              Tauri 客户端
                            </NButton>
                          </NFlex>
                        </div>

                        <div class="about-meta-item">
                          <NText depth="3">
                            交流与反馈群
                          </NText>
                          <NText strong>
                            873260337
                          </NText>
                        </div>
                      </div>

                      <NDivider style="margin: 4px 0;" />

                      <NFlex
                        align="center"
                        justify="space-between"
                      >
                        <div>
                          <NText strong>
                            在线检查更新
                          </NText>
                          <div class="setting-hint">
                            查询服务端最新客户端版本并自动更新
                          </div>
                        </div>
                        <NButton
                          size="small"
                          type="primary"
                          secondary
                          :loading="isCheckingUpdate"
                          @click="handleCheckUpdate"
                        >
                          <template #icon>
                            <NIcon :component="ArrowSync24Regular" />
                          </template>
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
.notification-master-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-hint {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  margin-top: 2px;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius, 6px);
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.03));
}

.notification-text {
  min-width: 0;
}

.about-hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.about-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.about-meta-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.about-meta-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed var(--vtsuru-border);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
