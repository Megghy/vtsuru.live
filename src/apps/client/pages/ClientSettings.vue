<script setup lang="ts">
import {
  Alert24Filled,
  ArrowSync24Regular,
  Info24Filled,
  People24Regular,
  Save24Filled,
  Settings24Filled,
} from '@vicons/fluent'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ThemeType } from '@/api/client-types'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import BiliAccountManagerCard from '@/apps/client/components/settings/BiliAccountManagerCard.vue'
import ClientBackupPanel from '@/apps/client/components/settings/ClientBackupPanel.vue'
import type { NotificationType } from '@/apps/client/store/useSettings'
import { useSettings } from '@/apps/client/store/useSettings'
import { isTauri } from '@/shared/config/api'
import { clientVersion } from '@/shared/config/clientVersion'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'
import { useMessage } from '@/shared/utils'
import { useWebFetcher } from '@/store/useWebFetcher'

// --- State ---

const route = useRoute()
const router = useRouter()
const message = useMessage()
if (route.query.tab === 'transcription') void router.replace({ name: 'client-transcription' })
const currentTab = ref(route.query.tab === 'transcription' ? 'general' : (route.query.tab as string) || 'general')
const isLoading = ref(true)
const errorMsg = ref<string | null>(null)
const titleClickCount = ref(0)
let resetTimeout: number | null = null

const setting = useSettings()
const currentVersion = ref(clientVersion.value || '1.0.0')

// 更新检查
const isCheckingUpdate = ref(false)
const handleCheckUpdate = async () => {
  isCheckingUpdate.value = true
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()

    if (update) {
      message.info(`发现新版本 ${update.version}，正在下载更新...`)

      // 下载并安装更新
      await update.downloadAndInstall()

      message.success('更新已下载，重启应用以完成更新')

      // 询问是否立即重启
      const { relaunch } = await import('@tauri-apps/plugin-process')
      setTimeout(() => {
        void useWebFetcher()
          .Stop()
          .catch((err) => console.warn('重启前停止 EventFetcher 失败:', err))
          .then(() => relaunch())
      }, 2000)
    } else {
      message.success('当前已是最新版本')
    }
  } catch (err: any) {
    console.error('检查更新失败:', err)
    message.error(`检查更新失败: ${err}`)
  } finally {
    isCheckingUpdate.value = false
  }
}

// Navigation Options
const navItems = [
  { label: '常规设置', key: 'general', icon: Settings24Filled },
  { label: 'B站账号管理', key: 'bili-accounts', icon: People24Regular },
  { label: '系统通知', key: 'notification', icon: Alert24Filled },
  { label: '数据备份', key: 'backup', icon: Save24Filled },
  { label: '关于程序', key: 'about', icon: Info24Filled },
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
  if (isTauri()) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      currentVersion.value = await getVersion()
    } catch (e) {
      console.warn('获取客户端版本失败:', e)
    }

    try {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart')
      isStartOnBoot.value = await isEnabled()
    } catch (err) {
      console.error('Failed to fetch autostart status:', err)
      errorMsg.value = '无法获取开机启动状态，请稍后重试。'
    }
  }
  isLoading.value = false
})

// --- Watchers for Side Effects ---

watch(isStartOnBoot, async (newValue, oldValue) => {
  if (isLoading.value || newValue === oldValue) return
  if (!isTauri()) {
    message.warning('非桌面客户端环境，无法配置开机自启')
    isStartOnBoot.value = oldValue
    return
  }

  errorMsg.value = null
  isUpdatingAutostart.value = true
  try {
    const { enable, disable } = await import('@tauri-apps/plugin-autostart')
    if (newValue) {
      await enable()
    } else {
      await disable()
    }
  } catch (err) {
    console.error('Failed to update autostart status:', err)
    errorMsg.value = `设置开机启动失败: ${err instanceof Error ? err.message : '未知错误'}`
    isStartOnBoot.value = oldValue
    message.error('设置开机启动失败')
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
    if (isTauri()) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('open_dev_tools')
          .then(() => message.success('已打开 Dev Tools'))
          .catch((e) => message.error(`打开 Dev Tools 失败: ${e}`))
      })
    } else {
      message.info('当前为浏览器环境，请直接按 F12 打开开发者工具')
    }
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5 client-readable">
    <Card class="p-3">
      <ClientPageHeader>
        <template #title>
          <span
            class="font-bold cursor-pointer"
            @click="handleTitleClick"
          >
            客户端设置
          </span>
        </template>
        <template #description> 配置系统启动行为、界面外观、桌面通知与数据备份 </template>
      </ClientPageHeader>
    </Card>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <!-- 左侧设置分类导航 -->
      <div class="md:col-span-1">
        <Card class="p-1">
          <nav class="flex flex-col gap-1">
            <button
              v-for="item in navItems"
              :key="item.key"
              type="button"
              class="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors text-left"
              :class="
                currentTab === item.key
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-[var(--foreground)] hover:bg-[var(--popover)]'
              "
              @click="currentTab = item.key"
            >
              <component
                :is="item.icon"
                class="w-4 h-4"
              />
              <span>{{ item.label }}</span>
            </button>
          </nav>
        </Card>
      </div>

      <!-- 右侧设置内容 -->
      <div class="md:col-span-3">
        <div
          v-if="isLoading"
          class="flex items-center justify-center p-8 text-xs text-[var(--muted-foreground)] gap-2"
        >
          <Spin class="w-4 h-4" />
          <span>正在加载设置...</span>
        </div>

        <div
          v-else
          class="flex flex-col gap-3"
        >
          <Alert
            v-if="errorMsg"
            variant="destructive"
            class="mb-2"
          >
            <AlertTitle>操作错误</AlertTitle>
            <AlertDescription class="flex items-center justify-between">
              <span>{{ errorMsg }}</span>
              <Button
                variant="ghost"
                class="h-6 px-2"
                @click="errorMsg = null"
              >
                关闭
              </Button>
            </AlertDescription>
          </Alert>

          <Transition
            mode="out-in"
            enter-active-class="transition-opacity duration-150"
            enter-from-class="opacity-0"
            leave-active-class="transition-opacity duration-150"
            leave-to-class="opacity-0"
          >
            <div :key="currentTab">
              <!-- 常规设置 -->
              <template v-if="currentTab === 'general'">
                <div class="flex flex-col gap-3">
                  <Card>
                    <CardHeader class="py-3 px-4">
                      <CardTitle class="text-sm font-semibold">启动偏好</CardTitle>
                    </CardHeader>
                    <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-3">
                      <LabelItem
                        label="开机时自动启动应用"
                        label-placement="left"
                      >
                        <Switch
                          :checked="isStartOnBoot"
                          :disabled="isLoading || isUpdatingAutostart"
                          @update:checked="(val) => (isStartOnBoot = val)"
                        />
                      </LabelItem>

                      <LabelItem
                        v-if="isStartOnBoot"
                        label="启动后静默最小化到系统托盘"
                        label-placement="left"
                      >
                        <Switch
                          :checked="setting.settings.bootAsMinimized"
                          @update:checked="
                            (val) => {
                              setting.settings.bootAsMinimized = val
                              setting.save()
                            }
                          "
                        />
                      </LabelItem>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader class="py-3 px-4">
                      <CardTitle class="text-sm font-semibold">界面外观</CardTitle>
                    </CardHeader>
                    <CardContent class="px-4 pb-4 pt-0">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-medium text-[var(--foreground)]">主题模式</span>
                        <RadioGroup
                          :model-value="themeType"
                          class="flex items-center gap-3"
                          @update:model-value="(val) => (themeType = val as ThemeType)"
                        >
                          <div class="flex items-center space-x-1.5">
                            <RadioGroupItem
                              id="theme-light"
                              :value="ThemeType.Light"
                            />
                            <label
                              for="theme-light"
                              class="text-xs cursor-pointer"
                              >亮色</label
                            >
                          </div>
                          <div class="flex items-center space-x-1.5">
                            <RadioGroupItem
                              id="theme-dark"
                              :value="ThemeType.Dark"
                            />
                            <label
                              for="theme-dark"
                              class="text-xs cursor-pointer"
                              >暗色</label
                            >
                          </div>
                          <div class="flex items-center space-x-1.5">
                            <RadioGroupItem
                              id="theme-auto"
                              :value="ThemeType.Auto"
                            />
                            <label
                              for="theme-auto"
                              class="text-xs cursor-pointer"
                              >跟随系统</label
                            >
                          </div>
                        </RadioGroup>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </template>

              <!-- B站账号管理 -->
              <template v-else-if="currentTab === 'bili-accounts'">
                <BiliAccountManagerCard />
              </template>

              <!-- 系统通知 -->
              <template v-else-if="currentTab === 'notification'">
                <Card>
                  <CardHeader class="py-3 px-4">
                    <CardTitle class="text-sm font-semibold">系统通知</CardTitle>
                  </CardHeader>
                  <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-3.5">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <span class="font-bold text-xs text-foreground">桌面通知总开关</span>
                        <div class="text-xs text-muted-foreground mt-0.5">
                          开启后，选中的事件将在 Windows 桌面右下角推送通知
                        </div>
                      </div>
                      <Switch
                        :checked="setting.settings.enableNotification"
                        @update:checked="
                          (val) => {
                            setting.settings.enableNotification = val
                            setting.save()
                          }
                        "
                      />
                    </div>

                    <Separator />

                    <div
                      v-if="setting.settings.enableNotification"
                      class="flex flex-col gap-2.5"
                    >
                      <div
                        v-for="item in notificationItems"
                        :key="item.type"
                        class="flex items-center justify-between py-2 px-3 border border-border rounded-md bg-muted"
                      >
                        <div class="min-w-0 pr-2">
                          <span class="font-bold text-xs text-foreground">{{ item.title }}</span>
                          <div class="text-xs text-muted-foreground mt-0.5">
                            {{ item.desc }}
                          </div>
                        </div>
                        <Switch
                          :checked="isNotificationTypeEnabled(item.type)"
                          @update:checked="(val) => toggleNotificationType(item.type, val)"
                        />
                      </div>
                    </div>

                    <span
                      v-else
                      class="text-center py-3 text-xs text-muted-foreground"
                    >
                      桌面通知已全局关闭
                    </span>
                  </CardContent>
                </Card>
              </template>

              <!-- 数据备份 -->
              <template v-else-if="currentTab === 'backup'">
                <Card>
                  <CardHeader class="py-3 px-4">
                    <CardTitle class="text-sm font-semibold">数据备份</CardTitle>
                  </CardHeader>
                  <CardContent class="px-4 pb-4 pt-0">
                    <ClientBackupPanel />
                  </CardContent>
                </Card>
              </template>

              <!-- 关于程序 -->
              <template v-else-if="currentTab === 'about'">
                <Card>
                  <CardHeader class="py-3 px-4">
                    <CardTitle class="text-sm font-semibold">关于 VTsuru.Client</CardTitle>
                  </CardHeader>
                  <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-3.5">
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-base text-foreground"> VTsuru EventFetcher </span>
                        <Tag variant="secondary"> v{{ currentVersion }} </Tag>
                      </div>
                      <span class="text-xs text-muted-foreground">
                        专为 Bilibili 主播打造的现代化全功能直播辅助与事件采集桌面客户端
                      </span>
                    </div>

                    <div class="flex flex-col gap-2 text-[13px]">
                      <div class="flex items-center justify-between py-1.5 border-b border-dashed border-border">
                        <span class="text-xs text-muted-foreground">作者</span>
                        <a
                          href="https://space.bilibili.com/10021741"
                          target="_blank"
                          class="text-xs text-primary hover:underline"
                        >
                          Megghy
                        </a>
                      </div>

                      <div class="flex items-center justify-between py-1.5 border-b border-dashed border-border">
                        <span class="text-xs text-muted-foreground">开源仓库</span>
                        <div class="flex items-center gap-2">
                          <a
                            href="https://github.com/Megghy/vtsuru.live"
                            target="_blank"
                            class="text-xs text-primary hover:underline"
                          >
                            Web 平台
                          </a>
                          <span class="opacity-40">/</span>
                          <a
                            href="https://github.com/Megghy/vtsuru-fetcher-client"
                            target="_blank"
                            class="text-xs text-primary hover:underline"
                          >
                            Tauri 客户端
                          </a>
                        </div>
                      </div>

                      <div class="flex items-center justify-between py-1.5 border-b border-dashed border-border">
                        <span class="text-xs text-muted-foreground">交流与反馈群</span>
                        <span class="font-bold text-xs text-foreground">873260337</span>
                      </div>
                    </div>

                    <Separator />

                    <div class="flex items-center justify-between">
                      <div>
                        <span class="font-bold text-xs text-foreground">在线检查更新</span>
                        <div class="text-xs text-muted-foreground mt-0.5">查询服务端最新客户端版本并自动更新</div>
                      </div>
                      <Button
                        variant="secondary"
                        class="gap-1.5"
                        :disabled="isCheckingUpdate"
                        @click="handleCheckUpdate"
                      >
                        <component
                          :is="ArrowSync24Regular"
                          class="w-4 h-4"
                          :class="{ 'animate-spin': isCheckingUpdate }"
                        />
                        <span>检查更新</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </template>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>
