<script setup lang="ts">
import { Info24Filled, Mic24Filled, Question24Regular } from '@vicons/fluent'
import {
  ColorPaletteOutline,
  CopyOutline,
  EyeOffOutline,
  EyeOutline,
  ImageOutline,
  OpenOutline,
} from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { GetSelfAccount, logoutAccount, useAccount } from '@/api/account'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import {
  postApiAccountBindBili,
  postApiAccountChangeBili,
  postApiAccountChangeName,
  postApiAccountResetBili,
  postApiAccountResetToken,
} from '@/api/generated/account/account'
import AccountSecurityPanel from '@/apps/account/components/AccountSecurityPanel.vue'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import WorkspaceSwitch from '@/apps/manage/components/layout/WorkspaceSwitch.vue'
import SettingPaymentView from '@/apps/manage/pages/settings/SettingPaymentView.vue'
import SettingsManageView from '@/apps/manage/pages/settings/SettingsManageView.vue'
import TemplateManager from '@/apps/manage/pages/settings/TemplateManager.vue'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { refreshCaptcha, requestWithCaptchaRetry } from '@/shared/captcha'
import { availableAPIs, currentAPIKey, isDev, setSelectedAPIKey } from '@/shared/config'
import { checkUpdateNote } from '@/shared/services/UpdateNote'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'
import { copyToClipboard } from '@/shared/utils'

const token = ref('')
const turnstile = ref()

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const selectedTab = useRouteQueryParam('tab', 'info', { transform: String })

watch(
  () => [selectedTab.value, route.query.setting] as const,
  ([tab, setting]) => {
    if (tab === 'setting' && setting === 'index') {
      void router.replace({ name: 'manage-userPageBuilder', query: { mode: 'legacy' } })
    }
  },
  { immediate: true },
)

const bindBiliCodeModalVisible = ref(false)
const resetNameModalVisible = ref(false)
const showToken = ref(false)

const newName = ref('')
const biliCode = ref('')
const isLoading = ref(false)

const formattedCreateAt = computed(() => {
  const ts = accountInfo.value?.createAt
  if (!ts) return ''
  const date = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
})

function goToDecorate(action?: 'theme') {
  if (action) {
    void router.push({ name: 'manage-userPageBuilder', query: { action } })
  } else {
    void router.push({ name: 'manage-userPageBuilder' })
  }
}

function goToUserPublicPage() {
  if (!accountInfo.value?.name) return
  void router.push({ name: 'user-index', params: { id: accountInfo.value.name } })
}

const apiOptions = availableAPIs.map((api) => ({
  label: api.name,
  value: api.key,
}))

async function handleAPIChange(value: any) {
  const selected = availableAPIs.find((api) => api.key === value)
  message.info(`正在切换到${selected?.name}...`)
  await setSelectedAPIKey(value as 'main' | 'failover')
  location.reload()
}

async function refreshAccountState() {
  await GetSelfAccount()
}

function resetBili() {
  isLoading.value = true
  postApiAccountResetBili()
    .then(async (data) => {
      if (data.code === 200) {
        message.success('已解绑 Bilibili 主播账号')
        await refreshAccountState()
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error(`解除失败: ${err}`)
    })
    .finally(() => {
      isLoading.value = false
    })
}

function resetName() {
  if (!newName.value.trim()) {
    message.error('用户名不能为空')
    return
  }
  isLoading.value = true
  postApiAccountChangeName({ name: newName.value.trim() })
    .then(async (data) => {
      if (data.code === 200) {
        message.success('已修改用户名')
        resetNameModalVisible.value = false
        newName.value = ''
        await refreshAccountState()
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error(`修改失败: ${err}`)
    })
    .finally(() => {
      isLoading.value = false
    })
}

async function resetToken() {
  isLoading.value = true
  try {
    const data = (await postApiAccountResetToken()) as unknown as {
      code: number
      message?: string
      data: string
    }
    if (data.code === 200) {
      message.success('已重新生成 Token')
      accountInfo.value.token = data.data
    } else {
      message.error(data.message)
    }
  } catch (err) {
    message.error(`发生错误: ${err}`)
  } finally {
    isLoading.value = false
  }
}

async function submitBiliCode(path: 'bind-bili' | 'change-bili', successText: string) {
  if (!biliCode.value) {
    message.error('身份码不能为空')
    return
  }
  isLoading.value = true
  try {
    const data = await requestWithCaptchaRetry<{ code: number; message?: string }>({
      getToken: () => token.value,
      refresh: () => refreshCaptcha(turnstile.value),
      request: (captchaToken) => {
        const headers = { Turnstile: captchaToken }
        return path === 'bind-bili'
          ? (postApiAccountBindBili({ code: biliCode.value }, { headers }) as any)
          : (postApiAccountChangeBili({ code: biliCode.value }, { headers }) as any)
      },
    })
    if (data.code === 200) {
      message.success(successText)
      bindBiliCodeModalVisible.value = false
      biliCode.value = ''
      await refreshAccountState()
      return
    }
    message.error(data.message)
  } catch (err) {
    console.error(err)
    message.error('发生错误')
  } finally {
    turnstile.value?.reset()
    isLoading.value = false
  }
}

function BindBili() {
  return submitBiliCode(
    'bind-bili',
    '已绑定, 如无特殊情况请勿刷新身份码, 如果刷新了且还需要使用本站直播相关功能请更新身份码',
  )
}

function ChangeBili() {
  return submitBiliCode('change-bili', '已更新身份码')
}

onMounted(() => {
  checkUpdateNote()
})

onUnmounted(() => {
  turnstile.value?.remove()
})
</script>

<template>
  <div
    class="flex flex-col gap-3 w-full mx-auto transition-all"
    :class="selectedTab === 'template' ? 'max-w-none' : 'max-w-4xl'"
  >
    <!-- 身份码失效告警 -->
    <Alert
      v-if="accountInfo?.biliAuthCodeStatus === BiliAuthCodeStatusType.Inactive"
      variant="destructive"
      class="border-destructive/40 bg-destructive/10"
    >
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <AlertTitle class="text-xs font-semibold"> 身份码已失效 </AlertTitle>
          <AlertDescription class="text-xs"> 你的身份码已失效, 这会导致无法获取直播间数据. </AlertDescription>
        </div>
        <Button
          size="xs"
          variant="destructive"
          @click="bindBiliCodeModalVisible = true"
        >
          更新身份码
        </Button>
      </div>
    </Alert>

    <!-- 个人主页装扮常驻入口横幅 -->
    <div
      v-if="accountInfo"
      class="rounded-lg border border-border bg-card p-3.5 shadow-sm transition-colors hover:border-brand/40 flex items-center justify-between gap-3 flex-wrap"
    >
      <div class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-md bg-brand/10 text-brand flex items-center justify-center shrink-0">
          <component
            :is="ColorPaletteOutline"
            class="h-5 w-5"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="text-sm font-semibold text-foreground">个性化你的主播主页</div>
          <div class="text-xs text-muted-foreground">
            为展示页定制全站壁纸、主题色及日程/歌单/提问箱等模块，打造专属主播风格。
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          size="xs"
          variant="outline"
          @click="goToDecorate('theme')"
        >
          <component
            :is="ImageOutline"
            class="h-3.5 w-3.5 mr-1"
          />
          设置背景与主题
        </Button>
        <Button
          size="xs"
          variant="brand"
          @click="goToDecorate()"
        >
          <component
            :is="ColorPaletteOutline"
            class="h-3.5 w-3.5 mr-1"
          />
          主页装修
        </Button>
      </div>
    </div>

    <!-- 顶层 Tabs -->
    <Tabs
      v-if="accountInfo"
      v-model="selectedTab"
      class="w-full"
      :class="{ 'dashboard-view--wide': selectedTab === 'template' }"
    >
      <TabsList class="inline-flex p-1 bg-muted rounded-lg">
        <TabsTrigger
          value="info"
          class="text-xs px-3 h-6"
        >
          个人信息
        </TabsTrigger>
        <TabsTrigger
          value="setting"
          class="text-xs px-3 h-6"
        >
          设置
        </TabsTrigger>
        <TabsTrigger
          value="template"
          class="text-xs px-3 h-6"
        >
          模板
        </TabsTrigger>
        <TabsTrigger
          v-if="isDev"
          value="billing"
          class="text-xs px-3 h-6"
        >
          增值 (dev)
        </TabsTrigger>
      </TabsList>

      <!-- 个人信息 Tab -->
      <TabsContent
        value="info"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardContent class="p-4 space-y-4">
            <!-- 头部概览 -->
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="flex flex-col gap-1">
                <span class="text-xl font-bold tracking-tight text-foreground">{{ accountInfo?.name }}</span>
                <span
                  v-if="formattedCreateAt"
                  class="text-xs text-muted-foreground"
                  >注册于 {{ formattedCreateAt }}</span
                >
              </div>

              <div class="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="xs"
                  variant="outline"
                  @click="goToDecorate('theme')"
                >
                  <component
                    :is="ImageOutline"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  更换背景
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  @click="goToDecorate()"
                >
                  <component
                    :is="ColorPaletteOutline"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  主页装修
                </Button>
                <Button
                  v-if="accountInfo?.name"
                  size="xs"
                  variant="ghost"
                  title="在新标签页查看公开主页"
                  @click="goToUserPublicPage"
                >
                  <component
                    :is="OpenOutline"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  查看主页
                </Button>
                <code class="px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground font-mono">
                  #{{ accountInfo?.id }}
                </code>
                <Button
                  size="xs"
                  variant="outline"
                  @click="resetNameModalVisible = true"
                >
                  修改用户名
                </Button>

                <!-- 登出按钮 + AlertDialog -->
                <AlertDialog>
                  <AlertDialogTrigger as-child>
                    <Button
                      size="xs"
                      variant="destructive"
                    >
                      登出
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent class="sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>确定登出账号？</AlertDialogTitle>
                      <AlertDialogDescription class="text-xs">
                        登出后你需要重新验证身份才能登录管理后台。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        @click="logoutAccount"
                      >
                        确认登出
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <Separator />

            <!-- 账号安全面板 -->
            <AccountSecurityPanel />

            <!-- 连接状态区域 -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <!-- 主播 Bilibili 账户卡片 -->
              <div class="p-3.5 rounded-lg border border-border bg-card space-y-2">
                <div class="text-xs font-semibold tracking-wide text-foreground uppercase">主播 Bilibili 账户</div>

                <div
                  v-if="accountInfo?.isBiliVerified"
                  class="flex items-center justify-between gap-3 flex-wrap"
                >
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-medium text-primary">已认证 | {{ accountInfo?.biliId }}</span>

                    <Badge
                      v-if="accountInfo.biliAuthCodeStatus === BiliAuthCodeStatusType.Active"
                      variant="success"
                      class="text-[11px]"
                    >
                      身份码: 有效
                    </Badge>
                    <Badge
                      v-else-if="accountInfo.biliAuthCodeStatus === BiliAuthCodeStatusType.Inactive"
                      variant="destructive"
                      class="text-[11px]"
                    >
                      身份码: 需更新
                    </Badge>
                    <Badge
                      v-else-if="accountInfo.biliAuthCodeStatus === BiliAuthCodeStatusType.Notfound"
                      variant="warning"
                      class="text-[11px] gap-1"
                    >
                      身份码: 需绑定
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <component
                              :is="Mic24Filled"
                              class="h-3 w-3 inline cursor-help"
                            />
                          </TooltipTrigger>
                          <TooltipContent class="text-xs"> 如果你不是主播的话则不需要在意这个提示 </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Badge>
                  </div>

                  <div class="flex items-center gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      @click="bindBiliCodeModalVisible = true"
                    >
                      更新身份码
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger as-child>
                        <Button
                          size="xs"
                          variant="ghost"
                          class="text-destructive hover:bg-destructive/10"
                        >
                          解除认证
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent class="sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle>确定解除认证吗？</AlertDialogTitle>
                          <AlertDialogDescription class="text-xs text-destructive">
                            解除后现有的数据跟踪数据将被删除并且无法恢复！
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            @click="resetBili"
                          >
                            确认解除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div
                  v-else
                  class="flex items-center justify-between gap-3 flex-wrap"
                >
                  <div class="flex items-center gap-2">
                    <Badge
                      variant="destructive"
                      class="text-[11px] gap-1"
                    >
                      未绑定
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <component
                              :is="Info24Filled"
                              class="h-3 w-3 inline cursor-help"
                            />
                          </TooltipTrigger>
                          <TooltipContent class="text-xs"> 如果你不是主播的话则不需要在意这个 </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Badge>
                  </div>

                  <Button
                    size="xs"
                    variant="brand"
                    @click="bindBiliCodeModalVisible = true"
                  >
                    进行绑定
                  </Button>
                </div>
              </div>

              <!-- EventFetcher 状态卡片 -->
              <EventFetcherStatusCard />
            </div>

            <!-- Token 卡片 -->
            <div class="p-3.5 rounded-lg border border-border bg-card space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold tracking-wide text-foreground uppercase">Token</span>
                <span class="text-[11px] text-muted-foreground">敏感凭据，用于 EventFetcher / OBS 鉴权</span>
              </div>

              <div class="flex items-center gap-2 max-w-lg">
                <div class="relative flex-1">
                  <Input
                    :type="showToken ? 'text' : 'password'"
                    :model-value="accountInfo?.token"
                    readonly
                    class="pr-8 font-mono"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    @click="showToken = !showToken"
                  >
                    <component
                      :is="showToken ? EyeOffOutline : EyeOutline"
                      class="h-4 w-4"
                    />
                  </button>
                </div>

                <Button
                  size="xs"
                  variant="outline"
                  :disabled="!accountInfo?.token"
                  @click="copyToClipboard(accountInfo?.token ?? '')"
                >
                  <component
                    :is="CopyOutline"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  复制
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger as-child>
                    <Button
                      size="xs"
                      variant="destructive"
                    >
                      重置
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent class="sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>确定要重新生成 Token 吗？</AlertDialogTitle>
                      <AlertDialogDescription class="text-xs">
                        重新生成后，之前使用该 Token 部署的 EventFetcher 等外部设施将立即失效，需重新配置。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        @click="resetToken"
                      >
                        确认重置
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <!-- API 节点切换 -->
            <div class="p-3.5 rounded-lg border border-border bg-card space-y-2">
              <div class="text-xs font-semibold tracking-wide text-foreground uppercase">API 节点设置</div>

              <div class="flex items-center gap-3 flex-wrap">
                <span class="text-xs text-muted-foreground">当前使用的 API 节点:</span>
                <Select
                  :model-value="currentAPIKey"
                  @update:model-value="handleAPIChange"
                >
                  <SelectTrigger class="w-48">
                    <SelectValue placeholder="选择 API 节点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="api in apiOptions"
                      :key="api.value"
                      :value="api.value"
                    >
                      {{ api.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span class="text-xs text-muted-foreground">如果访问速度较慢可以尝试切换 API</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 设置 Tab -->
      <TabsContent
        value="setting"
        class="mt-3"
      >
        <SettingsManageView />
      </TabsContent>

      <!-- 模板 Tab -->
      <TabsContent
        value="template"
        class="mt-3"
      >
        <TemplateManager />
      </TabsContent>

      <!-- 增值 Tab (仅 dev) -->
      <TabsContent
        v-if="isDev"
        value="billing"
        class="mt-3"
      >
        <SettingPaymentView />
      </TabsContent>
    </Tabs>

    <!-- 修改用户名弹窗 -->
    <Dialog v-model:open="resetNameModalVisible">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-base"> 修改用户名 </DialogTitle>
          <DialogDescription class="text-xs">
            用户名是你在 VTsuru 的公开标识，修改后展示页链接和提及名称将同步更新。
          </DialogDescription>
        </DialogHeader>

        <div class="py-2">
          <Input
            v-model="newName"
            placeholder="新用户名"
            @keyup.enter="resetName"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="resetNameModalVisible = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            :loading="isLoading"
            @click="resetName"
          >
            确定修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 绑定/更新身份码弹窗 -->
    <Dialog v-model:open="bindBiliCodeModalVisible">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-base"> 绑定 / 更新身份码 </DialogTitle>
          <DialogDescription class="text-xs">
            用于获取 Bilibili 直播间数据。刷新身份码后需要在这里同步更新。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div class="flex gap-2">
            <Input
              v-model="biliCode"
              placeholder="请输入身份码"
              class="flex-1 font-mono"
            />
            <Button
              as="a"
              href="https://play-live.bilibili.com/"
              target="_blank"
              variant="outline"
            >
              <component
                :is="Question24Regular"
                class="h-3.5 w-3.5 mr-1"
              />
              幻星页面
            </Button>
          </div>

          <div
            class="text-[11px] text-muted-foreground leading-relaxed p-2.5 rounded bg-muted/40 border border-border/50"
          >
            在幻星页面右侧，或前往
            <a
              href="https://link.bilibili.com/p/center/index#/my-room/start-live"
              target="_blank"
              class="text-primary underline font-medium"
            >
              开播页
            </a>
            直播信息处可获取身份码。
          </div>

          <CaptchaWidget
            ref="turnstile"
            v-model="token"
            class="mt-2"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="bindBiliCodeModalVisible = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            :disabled="!token"
            :loading="isLoading"
            @click="accountInfo?.isBiliVerified ? ChangeBili() : BindBili()"
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
