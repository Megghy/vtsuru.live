<script setup lang="ts">
import { error as logError, info as logInfo } from '@tauri-apps/plugin-log'
import {
  AddOutline,
  ChatbubbleEllipsesOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  CreateOutline,
  PersonOutline,
  QrCodeOutline,
  RefreshOutline,
  StarOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import QrcodeVue from 'qrcode.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useCooldown } from '@/apps/client/composables/useCooldown'
import { getLoginInfoAsync, getLoginUrlDataAsync } from '@/apps/client/data/biliLogin'
import type { BiliAccountItem } from '@/apps/client/store/useBiliAccountManager'
import { useBiliAccountManager } from '@/apps/client/store/useBiliAccountManager'
import type { CookieCloudConfig } from '@/apps/client/store/useBiliCookie'
import { useTauriStore } from '@/apps/client/store/useTauriStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const accountManager = useBiliAccountManager()

// 弹窗状态
const showAddModal = ref(false)
const addTab = ref<'qrcode' | 'cloud' | 'manual'>('qrcode')

// 扫码登录状态
const isQRCodeLogining = ref(false)
const loginUrl = ref('')
const loginKey = ref('')
const timer = ref(0)
const expiredTimer = ref(0)
const countdownTimer = ref(0)
const countdownKey = ref(0)
const loginStatus = ref<'expired' | 'unknown' | 'scanned' | 'waiting' | 'confirmed'>()
const newAccountAlias = ref('')

// 手动添加状态
const manualCookieInput = ref('')
const manualAliasInput = ref('')

// CookieCloud 配置
const BILI_MULTI_COOKIE_CLOUD_KEY = 'user.bilibili.multi_cookie_cloud'
const cookieCloudStore = useTauriStore().getTarget<CookieCloudConfig>(BILI_MULTI_COOKIE_CLOUD_KEY, {
  host: 'https://cookie.vtsuru.live',
  key: '',
  password: '',
})
const cloudConfig = ref<CookieCloudConfig>({ host: 'https://cookie.vtsuru.live', key: '', password: '' })
const isSyncingCloud = ref(false)

// 编辑备注状态
const editingAccountId = ref<string | null>(null)
const editingAliasText = ref('')

const isBatchChecking = ref(false)
const batchCheckCooldown = useCooldown(5000)

const QRCODE_EXPIRE_MS = 3 * 60 * 1000

const loginStatusText = computed(() => {
  switch (loginStatus.value) {
    case 'expired':
      return '二维码已过期'
    case 'scanned':
      return '已扫描，请在手机上确认'
    case 'waiting':
      return '请使用哔哩哔哩手机客户端扫码'
    case 'confirmed':
      return '登录成功'
    default:
      return '准备中...'
  }
})

// 主播号选项
const mainAccountOptions = computed(() => {
  return accountManager.accounts.map((acc) => ({
    label: `${acc.name} (UID: ${acc.mid})${acc.alias ? ` - [${acc.alias}]` : ''}`,
    value: acc.id,
    disabled: !acc.isValid,
  }))
})

// 自动发弹幕账号选项
const danmakuAccountOptions = computed(() => {
  const list = [
    {
      label: '跟随主播主账号 (默认)',
      value: 'main',
    },
  ]
  accountManager.accounts.forEach((acc) => {
    list.push({
      label: `${acc.name} (UID: ${acc.mid})${acc.alias ? ` - [${acc.alias}]` : ''}`,
      value: acc.id,
    })
  })
  return list
})

onMounted(async () => {
  const stored = await cookieCloudStore.get()
  if (stored) cloudConfig.value = stored
})

onUnmounted(() => {
  finishQRCodeLogin()
})

function finishQRCodeLogin() {
  isQRCodeLogining.value = false
  loginUrl.value = ''
  loginKey.value = ''
  if (timer.value) clearInterval(timer.value)
  if (expiredTimer.value) clearTimeout(expiredTimer.value)
  if (countdownTimer.value) clearInterval(countdownTimer.value)
}

async function startQRCodeLogin() {
  if (isQRCodeLogining.value) return
  isQRCodeLogining.value = true
  try {
    const data = await getLoginUrlDataAsync()
    loginUrl.value = data.url
    loginKey.value = data.qrcode_key
    loginStatus.value = 'waiting'

    expiredTimer.value = window.setTimeout(() => {
      loginStatus.value = 'expired'
      if (timer.value) clearInterval(timer.value)
    }, QRCODE_EXPIRE_MS)

    countdownTimer.value = window.setInterval(() => {
      countdownKey.value++
    }, 500)

    timer.value = window.setInterval(async () => {
      try {
        const login = await getLoginInfoAsync(loginKey.value)
        loginStatus.value = login.status
        if (login.status === 'confirmed') {
          await accountManager.addOrUpdateAccount(login.cookie, login.refresh_token, newAccountAlias.value || undefined)
          logInfo('多账号池扫码登录成功')
          toast.success('新账号已成功添加至账号池！')
          finishQRCodeLogin()
          showAddModal.value = false
          newAccountAlias.value = ''
        } else if (login.status === 'expired') {
          finishQRCodeLogin()
          toast.error('登录二维码已过期')
        }
      } catch (err) {
        logError(`轮询登录状态异常: ${String(err)}`)
      }
    }, 2000)
  } catch (err: any) {
    logError(`获取二维码失败: ${String(err)}`)
    toast.error('获取登录二维码失败，请重试')
    finishQRCodeLogin()
  }
}

async function handleManualAdd() {
  if (!manualCookieInput.value.trim()) {
    toast.warning('请输入 Cookie 字符串')
    return
  }
  try {
    await accountManager.addOrUpdateAccount(
      manualCookieInput.value.trim(),
      undefined,
      manualAliasInput.value.trim() || undefined,
    )
    toast.success('账号添加成功')
    manualCookieInput.value = ''
    manualAliasInput.value = ''
    showAddModal.value = false
  } catch (err: any) {
    toast.error(`添加失败: ${err?.message || String(err)}`)
  }
}

async function handleCloudImport() {
  try {
    isSyncingCloud.value = true
    await accountManager.importFromCookieCloud(cloudConfig.value)
    toast.success('从 CookieCloud 导入账号成功')
    showAddModal.value = false
  } catch (err: any) {
    toast.error(`导入失败: ${err?.message || String(err)}`)
  } finally {
    isSyncingCloud.value = false
  }
}

async function handleCheckSingle(acc: BiliAccountItem) {
  const valid = await accountManager.checkAccount(acc.id)
  if (valid) {
    toast.success(`账号 [${acc.name}] 状态正常`)
  } else {
    toast.error(`账号 [${acc.name}] Cookie 已失效，请重新扫码`)
  }
}

async function handleBatchCheck() {
  if (batchCheckCooldown.isCoolingDown()) {
    toast.warning(`请等待 ${batchCheckCooldown.remaining.value} 秒后再试`)
    return
  }
  try {
    isBatchChecking.value = true
    await accountManager.checkAllAccounts()
    batchCheckCooldown.trigger()
    toast.success('全部账号有效性检查完成')
  } finally {
    isBatchChecking.value = false
  }
}

function startEditAlias(acc: BiliAccountItem) {
  editingAccountId.value = acc.id
  editingAliasText.value = acc.alias || ''
}

async function saveEditAlias(acc: BiliAccountItem) {
  await accountManager.updateAccountAlias(acc.id, editingAliasText.value.trim())
  editingAccountId.value = null
  toast.success('备注已更新')
}

async function handleRemoveAccount(id: string) {
  await accountManager.removeAccount(id)
  toast.info('账号已从账号池移除')
}
</script>

<template>
  <div class="flex flex-col gap-3.5 bili-account-manager-card">
    <!-- 顶部操作与角色分配栏 -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-2 border-b">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <PersonOutline class="size-5 text-primary" />
            <div>
              <CardTitle class="text-sm font-semibold">B 站多账号管理池</CardTitle>
              <div class="text-xs text-muted-foreground mt-0.5">
                可任意添加多个 B 站账号，灵活指定主播号（主管开播与禁言）与自动化号（自动发送欢迎、感谢、回复与定时弹幕）
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Button variant="secondary" class="gap-1.5" :disabled="isBatchChecking" @click="handleBatchCheck">
              <RefreshOutline class="size-3.5" :class="{ 'animate-spin': isBatchChecking }" />
              检查全部有效性
            </Button>
            <Button class="gap-1.5" @click=" () => {
                  showAddModal = true
                  if (addTab === 'qrcode') startQRCodeLogin()
                }
              "
            >
              <AddOutline class="size-4" />
              添加新账号
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent class="p-3">
        <!-- 快速身份路由配置 -->
        <div class="routing-control-panel">
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex-1 min-w-[240px]">
              <div class="routing-label flex items-center gap-1">
                <StarOutline class="size-3.5 text-amber-500" />
                <span>主播管理账号（主管开播/关播/改分区/房管禁言）</span>
              </div>
              <Select
                :model-value="accountManager.routing.mainAccountId"
                @update:model-value="(val) => accountManager.setMainAccount(String(val ?? ''))"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="请选择主账号" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in mainAccountOptions"
                    :key="opt.value"
                    :value="opt.value"
                    :disabled="opt.disabled"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex-1 min-w-[240px]">
              <div class="routing-label flex items-center gap-1">
                <ChatbubbleEllipsesOutline class="size-3.5 text-primary" />
                <span>自动操作发弹幕/私信账号（入场/礼物/SC/回复/定时）</span>
              </div>
              <Select
                :model-value="accountManager.routing.danmakuAccountId"
                @update:model-value="(val) => accountManager.setDanmakuAccount(String(val ?? ''))"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择发弹幕账号" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in danmakuAccountOptions"
                    :key="opt.value"
                    :value="opt.value"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex flex-col justify-center pt-3.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <div class="flex items-center gap-2 cursor-pointer select-none">
                      <Switch :checked="accountManager.routing.fallbackToMain" @update:checked="(val) => accountManager.setFallbackToMain(val)"
                      />
                      <span class="text-xs text-muted-foreground">小号失效自动回退主账号</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs max-w-[260px]">
                    当选中的小号 Cookie 过期或异常时，自动回退到主播主账号发送，避免互动断档
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 账号列表 -->
    <div
      v-if="accountManager.accounts.length === 0"
      class="empty-box"
    >
      <Empty description="账号池中暂无 B 站账号">
        <Button class="mt-3" @click=" () => {
              showAddModal = true
              startQRCodeLogin()
            }
          "
        >
          立即扫码添加
        </Button>
      </Empty>
    </div>

    <div
      v-else
      class="accounts-grid"
    >
      <Card
        v-for="acc in accountManager.accounts"
        :key="acc.id"
        class="border bg-card account-card"
        :class="{
          'is-main': acc.id === accountManager.routing.mainAccountId,
          'is-danmaku':
            acc.id === accountManager.routing.danmakuAccountId ||
            (accountManager.routing.danmakuAccountId === 'main' && acc.id === accountManager.routing.mainAccountId),
        }"
      >
        <CardContent class="p-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <!-- 账号头像与信息 -->
            <div class="flex items-center gap-3">
              <img
                :src="acc.face || 'https://static.hdslb.com/images/member/noface.gif'"
                class="size-11 rounded-full border object-cover shrink-0"
                alt="avatar"
              />
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-semibold text-sm text-foreground">
                    {{ acc.name }}
                  </span>

                  <!-- 备注展示/内联编辑 -->
                  <div
                    v-if="editingAccountId === acc.id"
                    class="inline-flex items-center gap-1"
                  >
                    <Input v-model="editingAliasText" placeholder="输入备注" class="h-6 w-24" @keyup.enter="saveEditAlias(acc)" />
                    <Button size="xs" class="h-6 px-2" @click="saveEditAlias(acc)">
                      保存
                    </Button>
                    <Button size="xs" variant="ghost" class="h-6 px-2" @click="editingAccountId = null">
                      取消
                    </Button>
                  </div>
                  <Badge
                    v-else-if="acc.alias"
                    variant="outline"
                    class="text-[10px] h-5 px-1.5 cursor-pointer border-sky-500/40 text-sky-600 bg-sky-500/10"
                    @click="startEditAlias(acc)"
                  >
                    {{ acc.alias }}
                  </Badge>
                  <Button v-else size="xs" variant="ghost" class="h-5 px-1.5 text-[11px] text-muted-foreground gap-1" @click="startEditAlias(acc)">
                    <CreateOutline class="size-3" />
                    设备注
                  </Button>

                  <!-- 有效性 Badge -->
                  <Badge
                    v-if="acc.isValid"
                    variant="outline"
                    class="text-[10px] h-4.5 px-1.5 border-emerald-500/40 text-emerald-600 bg-emerald-500/10 gap-0.5"
                  >
                    <CheckmarkCircleOutline class="size-3" />
                    有效
                  </Badge>
                  <Badge
                    v-else
                    variant="outline"
                    class="text-[10px] h-4.5 px-1.5 border-destructive/40 text-destructive bg-destructive/10 gap-0.5"
                  >
                    <CloseCircleOutline class="size-3" />
                    已失效
                  </Badge>
                </div>

                <div class="text-xs text-muted-foreground mt-0.5">
                  UID: {{ acc.mid }}
                </div>
              </div>
            </div>

            <!-- 角色徽章与操作 -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <!-- 角色徽章 -->
              <Badge
                v-if="acc.id === accountManager.routing.mainAccountId"
                variant="outline"
                class="text-[10px] h-5 px-1.5 border-amber-500/40 text-amber-600 bg-amber-500/10 gap-1"
              >
                <StarOutline class="size-3" />
                主播管理
              </Badge>
              <Badge
                v-if="
                  acc.id === accountManager.routing.danmakuAccountId ||
                  (accountManager.routing.danmakuAccountId === 'main' && acc.id === accountManager.routing.mainAccountId)
                "
                variant="outline"
                class="text-[10px] h-5 px-1.5 border-sky-500/40 text-sky-600 bg-sky-500/10 gap-1"
              >
                <ChatbubbleEllipsesOutline class="size-3" />
                发弹幕
              </Badge>

              <!-- 操作按钮组 -->
              <Button size="xs" variant="secondary" class="gap-1" @click="handleCheckSingle(acc)">
                <RefreshOutline class="size-3" />
                检查
              </Button>

              <Button v-if="acc.id !== accountManager.routing.mainAccountId" size="xs" variant="outline" class="border-amber-500/40 text-amber-600 hover:bg-amber-500/10" @click="accountManager.setMainAccount(acc.id)">
                设为主播号
              </Button>

              <Button v-if="acc.id !== accountManager.routing.danmakuAccountId" size="xs" variant="outline" class="border-sky-500/40 text-sky-600 hover:bg-sky-500/10" @click="accountManager.setDanmakuAccount(acc.id)">
                设为发弹幕号
              </Button>

              <Popconfirm
                title="确认删除"
                @positive-click="handleRemoveAccount(acc.id)"
              >
                <template #trigger>
                  <Button size="xs" variant="outline" class="w-7 p-0 border-destructive/40 text-destructive hover:bg-destructive/10">
                    <TrashOutline class="size-3.5" />
                  </Button>
                </template>
                确定要将账号「{{ acc.name }}」从账号池中移除吗？
              </Popconfirm>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 添加新账号模态框 -->
    <Dialog v-model:open="showAddModal">
      <DialogContent class="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle class="text-base font-semibold">添加 B 站账号至账号池</DialogTitle>
        </DialogHeader>

        <Tabs
          v-model="addTab"
          class="w-full mt-2"
        >
          <TabsList class="grid w-full grid-cols-3">
            <TabsTrigger value="qrcode" class="text-xs">
              二维码扫码登录
            </TabsTrigger>
            <TabsTrigger value="cloud" class="text-xs">
              CookieCloud 导入
            </TabsTrigger>
            <TabsTrigger value="manual" class="text-xs">
              手动粘贴 Cookie
            </TabsTrigger>
          </TabsList>

          <!-- 扫码登录 -->
          <TabsContent value="qrcode" class="pt-3">
            <div class="flex flex-col items-center gap-3.5 py-2">
              <div
                v-if="isQRCodeLogining"
                class="qrcode-wrapper"
              >
                <QrcodeVue
                  :value="loginUrl"
                  :size="170"
                />
              </div>
              <div
                v-else
                class="h-[170px] flex items-center justify-center"
              >
                <Button class="h-9 gap-1.5" @click="startQRCodeLogin">
                  <QrCodeOutline class="size-4" />
                  点击生成登录二维码
                </Button>
              </div>

              <div class="text-xs font-medium text-foreground">
                {{ isQRCodeLogining ? loginStatusText : '请使用手机哔哩哔哩客户端扫码' }}
              </div>

              <div class="w-[85%] space-y-1">
                <span class="text-xs text-muted-foreground">账号备注别名 (可选)</span>
                <Input v-model="newAccountAlias" placeholder="例如: 房管机器人、小号、副播" />
              </div>

              <Button v-if="isQRCodeLogining" size="xs" variant="secondary" @click="finishQRCodeLogin">
                刷新二维码
              </Button>
            </div>
          </TabsContent>

          <!-- CookieCloud 导入 -->
          <TabsContent value="cloud" class="pt-3 space-y-3">
            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">CookieCloud 服务地址</span>
              <Input v-model="cloudConfig.host" placeholder="https://cookie.vtsuru.live" />
            </div>

            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">用户 Key</span>
              <Input v-model="cloudConfig.key" placeholder="请输入 CookieCloud Key" />
            </div>

            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">端到端加密密码</span>
              <Input v-model="cloudConfig.password" type="password" placeholder="请输入加密密码" />
            </div>

            <div class="flex justify-end pt-2">
              <Button :disabled="isSyncingCloud" @click="handleCloudImport">
                从云端拉取并添加
              </Button>
            </div>
          </TabsContent>

          <!-- 手动输入 -->
          <TabsContent value="manual" class="pt-3 space-y-3">
            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">账号备注别名 (可选)</span>
              <Input v-model="manualAliasInput" placeholder="例如: 感谢机器人" />
            </div>

            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">Cookie 完整字符串</span>
              <Textarea
                v-model="manualCookieInput"
                placeholder="粘贴包含 SESSDATA 和 bili_jct 的完整 Cookie"
                class="text-xs resize-none h-24"
              />
            </div>

            <div class="flex justify-end pt-2">
              <Button @click="handleManualAdd">
                验证并添加账号
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.bili-account-manager-card {
  width: 100%;
}

.routing-control-panel {
  padding: 12px 14px;
  background: var(--muted);
  border-radius: 6px;
  border: 1px solid var(--border);
}

.routing-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground);
  margin-bottom: 4px;
}

.accounts-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.account-card {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.account-card.is-main {
  border-left: 3px solid var(--vtsuru-warning, #f59e0b);
}

.account-card.is-danmaku {
  border-right: 3px solid var(--primary, #10b981);
}

.empty-box {
  padding: 40px 0;
  text-align: center;
  background: var(--popover);
  border-radius: 8px;
  border: 1px dashed var(--border);
}

.qrcode-wrapper {
  padding: 12px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
</style>
