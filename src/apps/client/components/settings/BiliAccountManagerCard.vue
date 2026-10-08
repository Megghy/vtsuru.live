<script setup lang="ts">
import { error as logError, info as logInfo } from '@tauri-apps/plugin-log'
import {
  AddOutline,
  ChatbubbleEllipsesOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  CloudDownloadOutline,
  CreateOutline,
  EyeOffOutline,
  EyeOutline,
  LogOutOutline,
  PersonOutline,
  QrCodeOutline,
  RefreshOutline,
  StarOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import {
  NAvatar,
  NButton,
  NCard,
  NDivider,
  NDropdown,
  NEllipsis,
  NEmpty,
  NFlex,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NPopconfirm,
  NQrCode,
  NSelect,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useCooldown } from '@/apps/client/composables/useCooldown'
import { getLoginInfoAsync, getLoginUrlDataAsync } from '@/apps/client/data/biliLogin'
import type { BiliAccountItem } from '@/apps/client/store/useBiliAccountManager'
import { useBiliAccountManager } from '@/apps/client/store/useBiliAccountManager'
import type { CookieCloudConfig } from '@/apps/client/store/useBiliCookie'
import { useTauriStore } from '@/apps/client/store/useTauriStore'

const accountManager = useBiliAccountManager()
const message = useMessage()

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
          message.success('新账号已成功添加至账号池！')
          finishQRCodeLogin()
          showAddModal.value = false
          newAccountAlias.value = ''
        } else if (login.status === 'expired') {
          finishQRCodeLogin()
          message.error('登录二维码已过期')
        }
      } catch (err) {
        logError(`轮询登录状态异常: ${String(err)}`)
      }
    }, 2000)
  } catch (err: any) {
    logError(`获取二维码失败: ${String(err)}`)
    message.error('获取登录二维码失败，请重试')
    finishQRCodeLogin()
  }
}

async function handleManualAdd() {
  if (!manualCookieInput.value.trim()) {
    message.warning('请输入 Cookie 字符串')
    return
  }
  try {
    await accountManager.addOrUpdateAccount(
      manualCookieInput.value.trim(),
      undefined,
      manualAliasInput.value.trim() || undefined,
    )
    message.success('账号添加成功')
    manualCookieInput.value = ''
    manualAliasInput.value = ''
    showAddModal.value = false
  } catch (err: any) {
    message.error(`添加失败: ${err?.message || String(err)}`)
  }
}

async function handleCloudImport() {
  try {
    isSyncingCloud.value = true
    await accountManager.importFromCookieCloud(cloudConfig.value)
    message.success('从 CookieCloud 导入账号成功')
    showAddModal.value = false
  } catch (err: any) {
    message.error(`导入失败: ${err?.message || String(err)}`)
  } finally {
    isSyncingCloud.value = false
  }
}

async function handleCheckSingle(acc: BiliAccountItem) {
  const valid = await accountManager.checkAccount(acc.id)
  if (valid) {
    message.success(`账号 [${acc.name}] 状态正常`)
  } else {
    message.error(`账号 [${acc.name}] Cookie 已失效，请重新扫码`)
  }
}

async function handleBatchCheck() {
  if (batchCheckCooldown.isCoolingDown()) {
    message.warning(`请等待 ${batchCheckCooldown.remaining.value} 秒后再试`)
    return
  }
  try {
    isBatchChecking.value = true
    await accountManager.checkAllAccounts()
    batchCheckCooldown.trigger()
    message.success('全部账号有效性检查完成')
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
  message.success('备注已更新')
}

async function handleRemoveAccount(id: string) {
  await accountManager.removeAccount(id)
  message.info('账号已从账号池移除')
}
</script>

<template>
  <NFlex
    vertical
    :size="14"
    class="bili-account-manager-card"
  >
    <!-- 顶部操作与角色分配栏 -->
    <NCard
      size="small"
      bordered
    >
      <template #header>
        <NFlex
          align="center"
          justify="space-between"
        >
          <NFlex
            align="center"
            :size="8"
          >
            <NIcon
              :component="PersonOutline"
              size="20"
              style="color: var(--vtsuru-primary)"
            />
            <div>
              <div style="font-size: 15px; font-weight: 600">B 站多账号管理池</div>
              <div style="font-size: 12px; color: var(--vtsuru-fg-muted); font-weight: normal">
                可任意添加多个 B 站账号，灵活指定主播号（主管开播与禁言）与自动化号（自动发送欢迎、感谢、回复与定时弹幕）
              </div>
            </div>
          </NFlex>

          <NFlex
            align="center"
            :size="8"
          >
            <NButton
              size="small"
              secondary
              :loading="isBatchChecking"
              @click="handleBatchCheck"
            >
              <template #icon>
                <NIcon :component="RefreshOutline" />
              </template>
              检查全部有效性
            </NButton>
            <NButton
              size="small"
              type="primary"
              @click="
                () => {
                  showAddModal = true
                  if (addTab === 'qrcode') startQRCodeLogin()
                }
              "
            >
              <template #icon>
                <NIcon :component="AddOutline" />
              </template>
              添加新账号
            </NButton>
          </NFlex>
        </NFlex>
      </template>

      <!-- 快速身份路由配置 -->
      <div class="routing-control-panel">
        <NFlex
          :size="16"
          align="center"
          wrap
        >
          <div style="flex: 1; min-width: 240px">
            <div class="routing-label">
              <NIcon
                :component="StarOutline"
                style="vertical-align: -2px; margin-right: 4px; color: var(--vtsuru-warning)"
              />
              主播管理账号（主管开播/关播/改分区/房管禁言）
            </div>
            <NSelect
              :value="accountManager.routing.mainAccountId"
              :options="mainAccountOptions"
              placeholder="请选择主账号"
              size="small"
              @update:value="(val) => accountManager.setMainAccount(val)"
            />
          </div>

          <div style="flex: 1; min-width: 240px">
            <div class="routing-label">
              <NIcon
                :component="ChatbubbleEllipsesOutline"
                style="vertical-align: -2px; margin-right: 4px; color: var(--vtsuru-primary)"
              />
              自动操作发弹幕/私信账号（入场/礼物/SC/回复/定时）
            </div>
            <NSelect
              :value="accountManager.routing.danmakuAccountId"
              :options="danmakuAccountOptions"
              placeholder="选择发弹幕账号"
              size="small"
              @update:value="(val) => accountManager.setDanmakuAccount(val)"
            />
          </div>

          <div style="display: flex; flex-direction: column; justify-content: center; padding-top: 14px">
            <NFlex
              align="center"
              :size="8"
            >
              <NTooltip>
                <template #trigger>
                  <NSwitch
                    :value="accountManager.routing.fallbackToMain"
                    size="small"
                    @update:value="(val) => accountManager.setFallbackToMain(val)"
                  />
                </template>
                当选中的小号 Cookie 过期或异常时，自动回退到主播主账号发送，避免互动断档
              </NTooltip>
              <span style="font-size: 12px; color: var(--vtsuru-fg-muted)">小号失效自动回退主账号</span>
            </NFlex>
          </div>
        </NFlex>
      </div>
    </NCard>

    <!-- 账号列表 -->
    <div
      v-if="accountManager.accounts.length === 0"
      class="empty-box"
    >
      <NEmpty description="账号池中暂无 B 站账号">
        <template #extra>
          <NButton
            type="primary"
            size="small"
            @click="
              () => {
                showAddModal = true
                startQRCodeLogin()
              }
            "
          >
            立即扫码添加
          </NButton>
        </template>
      </NEmpty>
    </div>

    <div
      v-else
      class="accounts-grid"
    >
      <NCard
        v-for="acc in accountManager.accounts"
        :key="acc.id"
        size="small"
        bordered
        class="account-card"
        :class="{
          'is-main': acc.id === accountManager.routing.mainAccountId,
          'is-danmaku':
            acc.id === accountManager.routing.danmakuAccountId ||
            (accountManager.routing.danmakuAccountId === 'main' && acc.id === accountManager.routing.mainAccountId),
        }"
      >
        <NFlex
          align="center"
          justify="space-between"
        >
          <!-- 账号头像与信息 -->
          <NFlex
            align="center"
            :size="12"
          >
            <NAvatar
              round
              :size="46"
              :src="acc.face"
              fallback-src="https://static.hdslb.com/images/member/noface.gif"
            />
            <div>
              <NFlex
                align="center"
                :size="6"
              >
                <NText
                  strong
                  style="font-size: 14px"
                >
                  {{ acc.name }}
                </NText>

                <!-- 备注展示/内联编辑 -->
                <div
                  v-if="editingAccountId === acc.id"
                  style="display: inline-flex; align-items: center; gap: 4px"
                >
                  <NInput
                    v-model:value="editingAliasText"
                    size="tiny"
                    placeholder="输入备注"
                    style="width: 100px"
                    @keyup.enter="saveEditAlias(acc)"
                  />
                  <NButton
                    size="tiny"
                    type="primary"
                    @click="saveEditAlias(acc)"
                  >
                    保存
                  </NButton>
                  <NButton
                    size="tiny"
                    @click="editingAccountId = null"
                  >
                    取消
                  </NButton>
                </div>
                <NTag
                  v-else-if="acc.alias"
                  size="small"
                  type="info"
                  round
                  style="cursor: pointer"
                  @click="startEditAlias(acc)"
                >
                  {{ acc.alias }}
                </NTag>
                <NButton
                  v-else
                  text
                  size="tiny"
                  style="color: var(--vtsuru-fg-muted)"
                  @click="startEditAlias(acc)"
                >
                  <template #icon>
                    <NIcon :component="CreateOutline" />
                  </template>
                  设备注
                </NButton>

                <!-- 有效性 Tag -->
                <NTag
                  v-if="acc.isValid"
                  type="success"
                  size="tiny"
                  round
                >
                  <template #icon>
                    <NIcon :component="CheckmarkCircleOutline" />
                  </template>
                  有效
                </NTag>
                <NTag
                  v-else
                  type="error"
                  size="tiny"
                  round
                >
                  <template #icon>
                    <NIcon :component="CloseCircleOutline" />
                  </template>
                  已失效
                </NTag>
              </NFlex>

              <div style="font-size: 12px; color: var(--vtsuru-fg-muted); margin-top: 2px">
                UID: {{ acc.mid }}
              </div>
            </div>
          </NFlex>

          <!-- 角色徽章与操作 -->
          <NFlex
            align="center"
            :size="8"
          >
            <!-- 角色徽章 -->
            <NTag
              v-if="acc.id === accountManager.routing.mainAccountId"
              type="warning"
              size="small"
              round
            >
              <template #icon>
                <NIcon :component="StarOutline" />
              </template>
              主播管理
            </NTag>
            <NTag
              v-if="
                acc.id === accountManager.routing.danmakuAccountId ||
                (accountManager.routing.danmakuAccountId === 'main' && acc.id === accountManager.routing.mainAccountId)
              "
              type="primary"
              size="small"
              round
            >
              <template #icon>
                <NIcon :component="ChatbubbleEllipsesOutline" />
              </template>
              发弹幕
            </NTag>

            <!-- 操作按钮组 -->
            <NButton
              size="tiny"
              secondary
              @click="handleCheckSingle(acc)"
            >
              <template #icon>
                <NIcon :component="RefreshOutline" />
              </template>
              检查
            </NButton>

            <NButton
              v-if="acc.id !== accountManager.routing.mainAccountId"
              size="tiny"
              secondary
              type="warning"
              @click="accountManager.setMainAccount(acc.id)"
            >
              设为主播号
            </NButton>

            <NButton
              v-if="acc.id !== accountManager.routing.danmakuAccountId"
              size="tiny"
              secondary
              type="primary"
              @click="accountManager.setDanmakuAccount(acc.id)"
            >
              设为发弹幕号
            </NButton>

            <NPopconfirm
              positive-text="确认删除"
              negative-text="取消"
              @positive-click="handleRemoveAccount(acc.id)"
            >
              <template #trigger>
                <NButton
                  size="tiny"
                  secondary
                  type="error"
                >
                  <template #icon>
                    <NIcon :component="TrashOutline" />
                  </template>
                </NButton>
              </template>
              确定要将账号「{{ acc.name }}」从账号池中移除吗？
            </NPopconfirm>
          </NFlex>
        </NFlex>
      </NCard>
    </div>

    <!-- 添加新账号模态框 -->
    <NModal
      v-model:show="showAddModal"
      preset="card"
      title="添加 B 站账号至账号池"
      style="width: 520px; max-width: 95vw"
      :segmented="true"
    >
      <NTabs
        v-model:value="addTab"
        type="segment"
        animated
      >
        <!-- 扫码登录 -->
        <NTabPane
          name="qrcode"
          tab="二维码扫码登录"
        >
          <NFlex
            vertical
            align="center"
            :size="14"
            style="padding: 16px 0"
          >
            <div
              v-if="isQRCodeLogining"
              class="qrcode-wrapper"
            >
              <NQrCode
                :value="loginUrl"
                :size="170"
              />
            </div>
            <div
              v-else
              style="height: 170px; display: flex; align-items: center; justify-content: center"
            >
              <NButton
                type="primary"
                @click="startQRCodeLogin"
              >
                <template #icon>
                  <NIcon :component="QrCodeOutline" />
                </template>
                点击生成登录二维码
              </NButton>
            </div>

            <div style="font-size: 13px; font-weight: 500">
              {{ isQRCodeLogining ? loginStatusText : '请使用手机哔哩哔哩客户端扫码' }}
            </div>

            <NFormItem
              label="账号备注别名 (可选)"
              :show-feedback="false"
              style="width: 80%"
            >
              <NInput
                v-model:value="newAccountAlias"
                placeholder="例如: 房管机器人、小号、副播"
              />
            </NFormItem>

            <NButton
              v-if="isQRCodeLogining"
              size="small"
              secondary
              @click="finishQRCodeLogin"
            >
              刷新二维码
            </NButton>
          </NFlex>
        </NTabPane>

        <!-- CookieCloud 导入 -->
        <NTabPane
          name="cloud"
          tab="CookieCloud 导入"
        >
          <NFlex
            vertical
            :size="12"
            style="padding-top: 10px"
          >
            <NFormItem
              label="CookieCloud 服务地址"
              :show-feedback="false"
            >
              <NInput
                v-model:value="cloudConfig.host"
                placeholder="https://cookie.vtsuru.live"
              />
            </NFormItem>
            <NFormItem
              label="用户 Key"
              :show-feedback="false"
            >
              <NInput
                v-model:value="cloudConfig.key"
                placeholder="请输入 CookieCloud Key"
              />
            </NFormItem>
            <NFormItem
              label="端到端加密密码"
              :show-feedback="false"
            >
              <NInput
                v-model:value="cloudConfig.password"
                type="password"
                show-password-on="click"
                placeholder="请输入加密密码"
              />
            </NFormItem>
            <NFlex justify="flex-end">
              <NButton
                type="primary"
                :loading="isSyncingCloud"
                @click="handleCloudImport"
              >
                从云端拉取并添加
              </NButton>
            </NFlex>
          </NFlex>
        </NTabPane>

        <!-- 手动输入 -->
        <NTabPane
          name="manual"
          tab="手动粘贴 Cookie"
        >
          <NFlex
            vertical
            :size="12"
            style="padding-top: 10px"
          >
            <NFormItem
              label="账号备注别名 (可选)"
              :show-feedback="false"
            >
              <NInput
                v-model:value="manualAliasInput"
                placeholder="例如: 感谢机器人"
              />
            </NFormItem>
            <NFormItem
              label="Cookie 完整字符串"
              :show-feedback="false"
            >
              <NInput
                v-model:value="manualCookieInput"
                type="textarea"
                placeholder="粘贴包含 SESSDATA 和 bili_jct 的完整 Cookie"
                :rows="4"
              />
            </NFormItem>
            <NFlex justify="flex-end">
              <NButton
                type="primary"
                @click="handleManualAdd"
              >
                验证并添加账号
              </NButton>
            </NFlex>
          </NFlex>
        </NTabPane>
      </NTabs>
    </NModal>
  </NFlex>
</template>

<style scoped>
.bili-account-manager-card {
  width: 100%;
}

.routing-control-panel {
  padding: 12px 14px;
  margin-top: 8px;
  background: var(--vtsuru-bg-inset, rgba(0, 0, 0, 0.03));
  border-radius: 6px;
  border: 1px solid var(--vtsuru-border);
}

.routing-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--vtsuru-fg);
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
  border-right: 3px solid var(--vtsuru-primary, #10b981);
}

.empty-box {
  padding: 40px 0;
  text-align: center;
  background: var(--vtsuru-bg-elevated);
  border-radius: 8px;
  border: 1px dashed var(--vtsuru-border);
}

.qrcode-wrapper {
  padding: 12px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
</style>
