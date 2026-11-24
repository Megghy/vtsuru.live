<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { Activity, Bell, HardDrive, Info, RefreshCw, Settings, Volume2 } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { ThemeType } from '@/api/client-types'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import ClientBackupPanel from '@/apps/client/components/settings/ClientBackupPanel.vue'
import ClientDiagnosticsPanel from '@/apps/client/components/settings/ClientDiagnosticsPanel.vue'
import { checkUpdate, isCheckingUpdate } from '@/apps/client/data/initialize'
import { sendCustomClientNotification } from '@/apps/client/data/notification'
import { playNotificationTone } from '@/apps/client/data/notificationSound'
import type { CloseWindowAction, NotificationType } from '@/apps/client/store/useSettings'
import { useSettings } from '@/apps/client/store/useSettings'
import { isTauri } from '@/shared/config/api'
import { clientVersion } from '@/shared/config/clientVersion'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'

const route = useRoute()
const router = useRouter()

function redirectLegacyTab(tab: unknown) {
  if (tab === 'transcription') {
    void router.replace({ name: 'client-transcription' })
    return true
  }
  if (tab === 'bili-accounts') {
    void router.replace({ name: 'client-account-manage', query: { tab: 'pool' } })
    return true
  }
  return false
}

const redirectedOnInit = redirectLegacyTab(route.query.tab)
const currentTab = ref(redirectedOnInit ? 'general' : (route.query.tab as string) || 'general')

watch(
  () => route.query.tab,
  (tab) => {
    if (redirectLegacyTab(tab)) return
    if (typeof tab === 'string' && tab) {
      currentTab.value = tab
    }
  },
)

const isLoading = ref(true)
const errorMsg = ref<string | null>(null)
const titleClickCount = ref(0)
let resetTimeout: number | null = null

const setting = useSettings()
const currentVersion = ref(clientVersion.value || '1.0.0')

const navItems = [
  { label: '常规设置', key: 'general', icon: Settings },
  { label: '系统通知', key: 'notification', icon: Bell },
  { label: '数据备份', key: 'backup', icon: HardDrive },
  { label: '诊断与日志', key: 'diagnostics', icon: Activity },
  { label: '关于程序', key: 'about', icon: Info },
]

const themeOptions = [
  { label: '亮色', value: ThemeType.Light },
  { label: '暗色', value: ThemeType.Dark },
  { label: '跟随系统', value: ThemeType.Auto },
]

const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)

const isStartOnBoot = ref(false)
const isUpdatingAutostart = ref(false)

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

watch(isStartOnBoot, async (newValue, oldValue) => {
  if (isLoading.value || newValue === oldValue) return
  if (!isTauri()) {
    toast.warning('非桌面客户端环境，无法配置开机自启')
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
    toast.error('设置开机启动失败')
  } finally {
    isUpdatingAutostart.value = false
  }
})

async function handleWatchdogAutoReloadChange(val: boolean) {
  setting.settings.watchdogAutoReload = val
  await setting.save()
  if (isTauri()) {
    invoke('set_heartbeat_auto_reload', { enabled: val }).catch((err) => {
      console.warn('[Settings] 同步看门狗自动重载配置失败:', err)
    })
  }
}

const closeWindowOptions: Array<{ label: string; value: CloseWindowAction }> = [
  { label: '最小化到系统托盘', value: 'minimize-to-tray' },
  { label: '直接退出客户端', value: 'exit' },
]

const soundVolumePercent = computed({
  get: () => Math.round((setting.settings.notificationSettings?.soundVolume ?? 0.5) * 100),
  set: (val: number) => {
    setting.settings.notificationSettings.soundVolume = Math.min(1, Math.max(0.05, (val || 50) / 100))
    void setting.save()
  },
})

function previewNotificationSound() {
  void playNotificationTone('chime', setting.settings.notificationSettings?.soundVolume ?? 0.5)
}

function sendTestNotification() {
  void sendCustomClientNotification({
    title: 'VTsuru.Client 测试通知',
    body: '如果你看到了这条弹窗，说明系统桌面通知与提示音工作正常。',
    showDesktop: true,
    showToast: true,
    playSound: setting.settings.notificationSettings?.enableSound ?? true,
    bypassGlobalSwitch: false,
  })
}

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
    desc: '当弹幕流启动失败、被踢下线或连接中断时在桌面提醒',
  },
  {
    type: 'message-failed',
    title: '私信发送失败通知',
    desc: '自动操作发送 B站私信失败时在桌面提醒',
  },
  {
    type: 'live-danmaku-failed',
    title: '直播弹幕发送失败通知',
    desc: '自动操作或客户端发送直播间弹幕失败时在桌面提醒',
  },
  {
    type: 'cookie-invalid',
    title: 'B 站 Cookie 失效通知',
    desc: '检测到主账号 B 站凭据过期或验证失败时立即提醒',
  },
  {
    type: 'live-status',
    title: '直播开播 / 下播状态通知',
    desc: '检测到绑定直播间开播或下播时发送桌面状态提醒',
  },
  {
    type: 'update',
    title: '客户端版本更新通知',
    desc: '后台检查到 VTsuru.Client 新版本可用时在桌面提醒',
  },
]

function isNotificationTypeEnabled(type: NotificationType): boolean {
  return setting.settings.notificationSettings?.enableTypes?.includes(type) ?? false
}

function toggleNotificationType(type: NotificationType, value: boolean) {
  setting.settings.notificationSettings ??= {
    enableTypes: [],
    onlyWhenHidden: false,
    enableSound: true,
    soundVolume: 0.5,
  }
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
      invoke('open_dev_tools')
        .then(() => toast.success('已打开 Dev Tools'))
        .catch((e) => toast.error(`打开 Dev Tools 失败: ${e}`))
    } else {
      toast.info('当前为浏览器环境，请直接按 F12 打开开发者工具')
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
        <template #description> 配置系统启动行为、界面外观、桌面通知、数据备份与运行诊断 </template>
      </ClientPageHeader>
    </Card>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <!-- 左侧设置分类导航 -->
      <div class="md:col-span-1">
        <Card class="p-1">
          <nav class="flex flex-col gap-1">
            <Button
              v-for="item in navItems"
              :key="item.key"
              :variant="currentTab === item.key ? 'default' : 'ghost'"
              class="w-full justify-start gap-2.5"
              @click="currentTab = item.key"
            >
              <component
                :is="item.icon"
                class="size-4"
              />
              <span>{{ item.label }}</span>
            </Button>
          </nav>
        </Card>
      </div>

      <!-- 右侧设置内容 -->
      <div class="md:col-span-3">
        <div
          v-if="isLoading"
          class="flex-center p-8 text-xs text-muted-foreground gap-2"
        >
          <Spin class="size-4" />
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
            <AlertDescription class="flex-between">
              <span>{{ errorMsg }}</span>
              <Button
                size="xs"
                variant="ghost"
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
                      <CardTitle>启动与稳定性</CardTitle>
                    </CardHeader>
                    <CardContent class="px-4 pb-4 flex flex-col gap-3">
                      <SettingRow
                        variant="none"
                        title="开机时自动启动应用"
                        description="随操作系统登录自动在后台拉起客户端"
                      >
                        <Switch
                          :checked="isStartOnBoot"
                          :disabled="isLoading || isUpdatingAutostart"
                          @update:checked="(val) => (isStartOnBoot = Boolean(val))"
                        />
                      </SettingRow>

                      <SettingRow
                        v-if="isStartOnBoot"
                        variant="none"
                        title="开机自启后最小化到托盘"
                        description="仅在开机自启时静默隐藏窗口，手动双击启动仍会正常展示主界面"
                      >
                        <Switch
                          :checked="setting.settings.bootAsMinimized"
                          @update:checked="
                            (val) => {
                              setting.settings.bootAsMinimized = Boolean(val)
                              setting.save()
                            }
                          "
                        />
                      </SettingRow>

                      <Separator />

                      <SettingRow
                        variant="none"
                        title="点击窗口关闭按钮时"
                        description="选择点击右上角关闭按钮后隐藏到托盘后台运行，或直接退出程序"
                      >
                        <div class="w-[180px]">
                          <Select
                            :model-value="setting.settings.closeWindowAction || 'minimize-to-tray'"
                            @update:model-value="
                              (val) => {
                                setting.settings.closeWindowAction = val as CloseWindowAction
                                setting.save()
                              }
                            "
                          >
                            <SelectTrigger class="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                v-for="opt in closeWindowOptions"
                                :key="opt.value"
                                :value="opt.value"
                              >
                                {{ opt.label }}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </SettingRow>

                      <Separator />

                      <SettingRow
                        variant="none"
                        title="界面卡死时自动重载（看门狗自愈）"
                        description="当主界面连续 30 秒未响应心跳时，由原生壳自动重载页面以恢复采集与服务"
                      >
                        <Switch
                          :checked="Boolean(setting.settings.watchdogAutoReload)"
                          @update:checked="(val) => void handleWatchdogAutoReloadChange(Boolean(val))"
                        />
                      </SettingRow>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader class="py-3 px-4">
                      <CardTitle>界面外观</CardTitle>
                    </CardHeader>
                    <CardContent class="px-4 pb-4">
                      <SettingRow
                        variant="none"
                        title="主题模式"
                      >
                        <div class="w-[160px]">
                          <Select
                            :model-value="themeType"
                            @update:model-value="(val) => (themeType = val as ThemeType)"
                          >
                            <SelectTrigger class="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                v-for="opt in themeOptions"
                                :key="opt.value"
                                :value="opt.value"
                              >
                                {{ opt.label }}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </SettingRow>
                    </CardContent>
                  </Card>
                </div>
              </template>

              <!-- 系统通知 -->
              <template v-else-if="currentTab === 'notification'">
                <Card>
                  <CardHeader class="py-3 px-4 flex-row items-center justify-between space-y-0">
                    <CardTitle>系统通知</CardTitle>
                    <Button
                      variant="outline"
                      size="xs"
                      class="gap-1.5"
                      @click="sendTestNotification"
                    >
                      <Bell class="size-3.5" />
                      发送测试通知
                    </Button>
                  </CardHeader>
                  <CardContent class="px-4 pb-4 flex flex-col gap-3.5">
                    <SettingRow
                      variant="none"
                      title="桌面通知总开关"
                      description="开启后，选中的事件将在桌面右下角推送通知"
                    >
                      <Switch
                        :checked="setting.settings.enableNotification"
                        @update:checked="
                          (val) => {
                            setting.settings.enableNotification = Boolean(val)
                            setting.save()
                          }
                        "
                      />
                    </SettingRow>

                    <template v-if="setting.settings.enableNotification">
                      <SettingRow
                        variant="none"
                        title="仅在后台或最小化时推送桌面通知"
                        description="当客户端主窗口处于前台聚焦状态时跳过系统桌面弹窗，减少打扰"
                      >
                        <Switch
                          :checked="Boolean(setting.settings.notificationSettings?.onlyWhenHidden)"
                          @update:checked="
                            (val) => {
                              setting.settings.notificationSettings.onlyWhenHidden = Boolean(val)
                              setting.save()
                            }
                          "
                        />
                      </SettingRow>

                      <SettingRow
                        variant="none"
                        title="通知提示音"
                        description="桌面通知弹出时播放轻量系统提示音"
                      >
                        <div class="flex items-center gap-2">
                          <template v-if="setting.settings.notificationSettings?.enableSound">
                            <NumberField
                              v-model="soundVolumePercent"
                              :min="10"
                              :max="100"
                              :step="10"
                              class="w-24"
                            />
                            <span class="text-xs text-muted-foreground">%</span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="试听提示音"
                              @click="previewNotificationSound"
                            >
                              <Volume2 class="size-3.5" />
                            </Button>
                          </template>
                          <Switch
                            :checked="setting.settings.notificationSettings?.enableSound ?? true"
                            @update:checked="
                              (val) => {
                                setting.settings.notificationSettings.enableSound = Boolean(val)
                                setting.save()
                              }
                            "
                          />
                        </div>
                      </SettingRow>
                    </template>

                    <Separator />

                    <div
                      v-if="setting.settings.enableNotification"
                      class="flex flex-col gap-2.5"
                    >
                      <SettingRow
                        v-for="item in notificationItems"
                        :key="item.type"
                        variant="compact"
                        :title="item.title"
                        :description="item.desc"
                      >
                        <Switch
                          :checked="isNotificationTypeEnabled(item.type)"
                          @update:checked="(val) => toggleNotificationType(item.type, Boolean(val))"
                        />
                      </SettingRow>
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
                    <CardTitle>数据备份</CardTitle>
                  </CardHeader>
                  <CardContent class="px-4 pb-4">
                    <ClientBackupPanel />
                  </CardContent>
                </Card>
              </template>

              <!-- 诊断与日志 -->
              <template v-else-if="currentTab === 'diagnostics'">
                <Card>
                  <CardHeader class="py-3 px-4">
                    <CardTitle>运行诊断与日志</CardTitle>
                  </CardHeader>
                  <CardContent class="px-4 pb-4">
                    <ClientDiagnosticsPanel />
                  </CardContent>
                </Card>
              </template>

              <!-- 关于程序 -->
              <template v-else-if="currentTab === 'about'">
                <Card>
                  <CardHeader class="py-3 px-4">
                    <CardTitle>关于 VTsuru.Client</CardTitle>
                  </CardHeader>
                  <CardContent class="px-4 pb-4 flex flex-col gap-3.5">
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-base text-foreground"> VTsuru EventFetcher </span>
                        <Tag variant="secondary"> v{{ currentVersion }} </Tag>
                      </div>
                      <span class="text-xs text-muted-foreground">
                        专为 Bilibili 主播打造的现代化全功能直播辅助与事件采集桌面客户端
                      </span>
                    </div>

                    <div class="flex flex-col gap-2 text-xs">
                      <div class="flex-between py-1.5 border-b border-dashed border-border">
                        <span class="text-muted-foreground">作者</span>
                        <a
                          href="https://space.bilibili.com/10021741"
                          target="_blank"
                          class="text-primary hover:underline"
                        >
                          Megghy
                        </a>
                      </div>

                      <div class="flex-between py-1.5 border-b border-dashed border-border">
                        <span class="text-muted-foreground">开源仓库</span>
                        <div class="flex items-center gap-2">
                          <a
                            href="https://github.com/Megghy/vtsuru.live"
                            target="_blank"
                            class="text-primary hover:underline"
                          >
                            Web 平台
                          </a>
                          <span class="opacity-40">/</span>
                          <a
                            href="https://github.com/Megghy/vtsuru-fetcher-client"
                            target="_blank"
                            class="text-primary hover:underline"
                          >
                            Tauri 客户端
                          </a>
                        </div>
                      </div>

                      <div class="flex-between py-1.5 border-b border-dashed border-border">
                        <span class="text-muted-foreground">交流与反馈群</span>
                        <span class="font-bold text-foreground">873260337</span>
                      </div>
                    </div>

                    <Separator />

                    <SettingRow
                      variant="none"
                      title="在线检查更新"
                      description="查询服务端最新客户端版本并自动下载安装"
                    >
                      <Button
                        variant="secondary"
                        class="gap-1.5"
                        :disabled="isCheckingUpdate"
                        @click="void checkUpdate(true)"
                      >
                        <RefreshCw
                          class="size-3.5"
                          :class="{ 'animate-spin': isCheckingUpdate }"
                        />
                        <span>检查更新</span>
                      </Button>
                    </SettingRow>
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
