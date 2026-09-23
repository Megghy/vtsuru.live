<script setup lang="ts">
import { Info24Filled, Mic24Filled, Question24Regular } from '@vicons/fluent'
import { DocumentTextOutline } from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NEllipsis,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NModal,
  NPopconfirm,
  NSelect,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { GetSelfAccount, useAccount } from '@/api/account'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import { cookie } from '@/api/auth'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import AccountSecurityPanel from '@/apps/account/components/AccountSecurityPanel.vue'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import WorkspaceSwitch from '@/apps/manage/components/layout/WorkspaceSwitch.vue'
import SettingPaymentView from '@/apps/manage/pages/settings/SettingPaymentView.vue'
import SettingsManageView from '@/apps/manage/pages/settings/SettingsManageView.vue'
import TemplateManager from '@/apps/manage/pages/settings/TemplateManager.vue'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { ACCOUNT_API_URL, availableAPIs, currentAPIKey, isDev, setSelectedAPIKey } from '@/shared/config'
import { checkUpdateNote } from '@/shared/services/UpdateNote'
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
    // 旧「主页设置」入口迁到自定义页面构建器
    if (tab === 'setting' && setting === 'index') {
      void router.replace({ name: 'manage-userPageBuilder', query: { mode: 'legacy' } })
    }
  },
  { immediate: true },
)

const bindBiliCodeModalVisiable = ref(false)
const resetNameModalVisiable = ref(false)

const newName = ref('')

const biliCode = ref('')
const isLoading = ref(false)

// API选择器选项
const apiOptions = availableAPIs.map((api) => ({
  label: api.name,
  value: api.key,
}))

// 切换 API 节点会改变全局 baseURL，必须整页重载
async function handleAPIChange(value: string) {
  message.info(`正在切换到${availableAPIs.find((api) => api.key === value)?.name}...`)
  await setSelectedAPIKey(value as 'main' | 'failover')
  location.reload()
}

// 登出后清空会话，必须整页重载
function logout() {
  cookie.value = undefined
  window.location.reload()
}
async function refreshAccountState() {
  await GetSelfAccount()
}

function resetBili() {
  isLoading.value = true
  QueryGetAPI(`${ACCOUNT_API_URL}reset-bili`)
    .then(async (data) => {
      if (data.code === 200) {
        message.success('已解绑 Bilibili 主播账号')
        await refreshAccountState()
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发生错误')
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function resetName() {
  if (accountInfo.value?.name === newName.value) {
    message.error('新用户名与旧用户名一致')
    return
  }
  isLoading.value = true
  try {
    const data = await QueryGetAPI(`${ACCOUNT_API_URL}change-name`, { name: newName.value })
    if (data.code === 200) {
      message.success('用户名已修改')
      resetNameModalVisiable.value = false
      await GetSelfAccount()
    } else {
      message.error(data.message)
    }
  } catch (err) {
    console.error(err)
    message.error('发生错误')
  } finally {
    isLoading.value = false
  }
}
async function resetToken() {
  isLoading.value = true
  await QueryPostAPI<string>(`${ACCOUNT_API_URL}reset-token`)
    .then(async (data) => {
      if (data.code === 200) {
        message.success('已重新生成 Token')

        accountInfo.value.token = data.data
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error(`发生错误: ${err}`)
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function BindBili() {
  if (!biliCode.value) {
    message.error('身份码不能为空')
    return
  }
  isLoading.value = true
  await QueryGetAPI<{
    uname: string
    uid: number
    uface: string
    room_id: number
  }>(`${ACCOUNT_API_URL}bind-bili`, { code: biliCode.value }, [['Turnstile', token.value]])
    .then(async (data) => {
      if (data.code == 200) {
        message.success('已绑定, 如无特殊情况请勿刷新身份码, 如果刷新了且还需要使用本站直播相关功能请更新身份码')
        bindBiliCodeModalVisiable.value = false
        biliCode.value = ''
        await refreshAccountState()
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发生错误')
    })
    .finally(() => {
      turnstile.value?.reset()
      isLoading.value = false
    })
}
async function ChangeBili() {
  if (!biliCode.value) {
    message.error('身份码不能为空')
    return
  }
  isLoading.value = true
  await QueryGetAPI<{
    uname: string
    uid: number
    uface: string
    room_id: number
  }>(`${ACCOUNT_API_URL}change-bili`, { code: biliCode.value }, [['Turnstile', token.value]])
    .then(async (data) => {
      if (data.code == 200) {
        message.success('已更新身份码')
        bindBiliCodeModalVisiable.value = false
        biliCode.value = ''
        await refreshAccountState()
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发生错误')
    })
    .finally(() => {
      turnstile.value?.reset()
      isLoading.value = false
    })
}
onMounted(() => {
  checkUpdateNote()
})
onUnmounted(() => {
  turnstile.value?.remove()
  // 当进入管理页时检查更新日志
})
</script>

<template>
  <div
    class="dashboard-view"
    :class="{ 'dashboard-view--wide': selectedTab === 'template' }"
  >
    <div class="dashboard-alerts">
      <NAlert
        v-if="accountInfo?.biliAuthCodeStatus === BiliAuthCodeStatusType.Inactive"
        type="error"
        title="身份码已失效"
        :bordered="false"
      >
        <NFlex
          justify="space-between"
          align="center"
          wrap
          :size="12"
        >
          <NText>你的身份码已失效, 这会导致无法获取直播间数据.</NText>
          <NButton
            size="small"
            type="error"
            @click="bindBiliCodeModalVisiable = true"
          >
            更新身份码
          </NButton>
        </NFlex>
      </NAlert>
    </div>

    <div
      v-if="accountInfo"
      class="dashboard-role"
    >
      <WorkspaceSwitch />
    </div>

    <NTabs
      v-if="accountInfo"
      v-model:value="selectedTab"
      type="segment"
      animated
      size="small"
      class="dashboard-tabs"
    >
      <NTabPane
        name="info"
        tab="个人信息"
        style="width: 100%"
        display-directive="show:lazy"
      >
        <NCard
          size="small"
          bordered
          :segmented="{ content: true }"
        >
          <NFlex
            vertical
            :size="12"
          >
            <NFlex
              justify="space-between"
              align="baseline"
              wrap
              :size="12"
            >
              <div class="dashboard-profile">
                <NText
                  strong
                  class="dashboard-profile__name"
                >
                  {{ accountInfo?.name }}
                </NText>
                <NText
                  depth="3"
                  class="dashboard-profile__meta"
                >
                  注册于 <NTime :time="accountInfo?.createAt" />
                </NText>
              </div>
              <NFlex
                align="center"
                justify="end"
                wrap
                :size="8"
              >
                <NButton
                  type="primary"
                  secondary
                  size="small"
                  @click="router.push({ name: 'manage-userPageBuilder' })"
                >
                  <template #icon>
                    <NIcon :component="DocumentTextOutline" />
                  </template>
                  自定义页面
                </NButton>
                <NText
                  depth="3"
                  code
                >
                  {{ accountInfo?.id }}
                </NText>
                <NButton
                  size="small"
                  secondary
                  @click="resetNameModalVisiable = true"
                >
                  修改用户名
                </NButton>
                <NPopconfirm @positive-click="logout">
                  <template #trigger>
                    <NButton
                      size="small"
                      type="error"
                      secondary
                    >
                      登出
                    </NButton>
                  </template>
                  确定登出?
                </NPopconfirm>
              </NFlex>
            </NFlex>

            <NFlex vertical>
              <AccountSecurityPanel />
              <NCard
                size="small"
                bordered
              >
                主播 Bilibili 账户:
                <NEllipsis
                  v-if="accountInfo?.isBiliVerified"
                  style="max-width: 100%"
                >
                  <NText style="color: var(--vtsuru-primary)">
                    <NFlex
                      :size="5"
                      align="center"
                    >
                      已认证 | {{ accountInfo?.biliId }}
                      <NTag
                        v-if="accountInfo.biliAuthCodeStatus === BiliAuthCodeStatusType.Active"
                        type="success"
                        size="small"
                        :bordered="false"
                      >
                        身份码: 有效
                      </NTag>
                      <NTag
                        v-else-if="accountInfo.biliAuthCodeStatus === BiliAuthCodeStatusType.Inactive"
                        type="error"
                        size="small"
                        :bordered="false"
                      >
                        身份码: 需更新
                      </NTag>
                      <NTag
                        v-else-if="accountInfo.biliAuthCodeStatus === BiliAuthCodeStatusType.Notfound"
                        type="warning"
                        size="small"
                        :bordered="false"
                      >
                        身份码: 需绑定
                        <NTooltip>
                          <template #trigger>
                            <NIcon :component="Mic24Filled" />
                          </template>
                          如果你不是主播的话则不需要在意这个提示
                        </NTooltip>
                      </NTag>
                      <NButton
                        size="tiny"
                        type="info"
                        @click="bindBiliCodeModalVisiable = true"
                      >
                        更新身份码
                      </NButton>
                      <NPopconfirm @positive-click="resetBili">
                        <template #trigger>
                          <NButton
                            size="tiny"
                            type="error"
                          >
                            解除认证
                          </NButton>
                        </template>
                        确定解除认证吗? 解除后现有的数据跟踪数据将被删除并且无法恢复
                      </NPopconfirm>
                    </NFlex>
                  </NText>
                </NEllipsis>
                <template v-else>
                  <NTag
                    type="error"
                    size="small"
                  >
                    未绑定
                    <NTooltip>
                      <template #trigger>
                        <NIcon :component="Info24Filled" />
                      </template>
                      如果你不是主播的话则不需要在意这个
                    </NTooltip>
                  </NTag>
                  <NDivider vertical />
                  <NButton
                    size="small"
                    type="info"
                    @click="bindBiliCodeModalVisiable = true"
                  >
                    进行绑定
                  </NButton>
                </template>
              </NCard>
              <EventFetcherStatusCard />
              <NAlert
                title="Token"
                type="info"
                size="small"
                :bordered="false"
              >
                请注意保管，这个东西可以完全操作你的账号（EventFetcher / 部分 OBS 接口会用到）
                <NInputGroup class="dashboard-token-group">
                  <NInput
                    type="password"
                    :value="accountInfo?.token"
                    show-password-on="click"
                    status="error"
                    readonly
                  />
                  <NButton
                    size="small"
                    secondary
                    :disabled="!accountInfo?.token"
                    @click="copyToClipboard(accountInfo?.token ?? '')"
                  >
                    复制
                  </NButton>
                  <NPopconfirm @positive-click="resetToken">
                    <template #trigger>
                      <NButton
                        type="error"
                        size="small"
                      >
                        重置
                      </NButton>
                    </template>
                    确定要重新生成 Token 吗? EventFetcher 等设施将需要重新部署
                  </NPopconfirm>
                </NInputGroup>
              </NAlert>
            </NFlex>
            <NDivider />

            <NAlert
              type="info"
              title="API 设置"
              size="small"
              :bordered="false"
            >
              <NFlex
                align="center"
                :wrap="true"
                :size="12"
              >
                <NText>当前使用的API:</NText>
                <NSelect
                  :value="currentAPIKey"
                  :options="apiOptions"
                  style="max-width: 220px"
                  @update:value="handleAPIChange"
                />
                <NText
                  depth="3"
                  style="font-size: 12px"
                >
                  如果访问速度较慢可以尝试切换API
                </NText>
              </NFlex>
            </NAlert>
            <NDivider />
          </NFlex>
        </NCard>
      </NTabPane>
      <NTabPane
        name="setting"
        tab="设置"
        display-directive="show:lazy"
      >
        <SettingsManageView />
      </NTabPane>
      <NTabPane
        name="template"
        tab="模板"
        display-directive="show:lazy"
      >
        <TemplateManager />
      </NTabPane>
      <!-- 增值服务仍在开发中，仅开发环境显示入口 -->
      <NTabPane
        v-if="isDev"
        name="billing"
        tab="增值 (dev)"
        display-directive="show:lazy"
      >
        <SettingPaymentView />
      </NTabPane>
    </NTabs>
  </div>
  <NModal
    v-model:show="resetNameModalVisiable"
    preset="card"
    title="修改用户名"
    style="width: 400px; max-width: 90%"
  >
    <NFlex vertical>
      <NInput
        v-model:value="newName"
        placeholder="新用户名"
      />
    </NFlex>
    <template #footer>
      <NButton
        type="warning"
        :loading="isLoading"
        @click="resetName"
      >
        确定修改
      </NButton>
    </template>
  </NModal>
  <NModal
    v-model:show="bindBiliCodeModalVisiable"
    preset="card"
    title="绑定/更新身份码"
    style="width: 400px; max-width: 90%"
  >
    <NFlex vertical>
      <NInputGroup>
        <NInput
          v-model:value="biliCode"
          placeholder="身份码"
        />
        <NTooltip>
          <template #trigger>
            <NButton
              type="primary"
              tag="a"
              href="https://play-live.bilibili.com/"
              target="_blank"
            >
              <template #icon>
                <NIcon>
                  <Question24Regular />
                </NIcon>
              </template>
              前往幻星页面
            </NButton>
          </template>
          在幻星页面右侧 或者
          <NButton
            text
            tag="a"
            href="https://link.bilibili.com/p/center/index#/my-room/start-live"
            target="_blank"
            type="success"
          >
            开播页 </NButton
          >直播信息处可以获取
          <br />
          刷新身份码后需要在这里更新
          <img
            src="https://files.vtsuru.suki.club/updatelog/dbc2b6fe-fc85-42f3-9167-78f15abe74ce.png"
            style="max-width: 400px; display: block; margin-top: 8px"
          />
        </NTooltip>
      </NInputGroup>
    </NFlex>
    <CaptchaWidget
      ref="turnstile"
      v-model="token"
      class="bind-captcha"
    />
    <template #footer>
      <NButton
        type="success"
        :disabled="!token"
        :loading="isLoading"
        @click="accountInfo?.isBiliVerified ? ChangeBili() : BindBili()"
      >
        确定
      </NButton>
    </template>
  </NModal>
</template>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
  transition: max-width 0.3s ease;
}

/* 模板页解除 920px 居中限制, 填满外层放宽后的容器 */
.dashboard-view--wide {
  max-width: none;
}

.dashboard-alerts {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dashboard-role {
  display: flex;
  justify-content: flex-end;
}

.dashboard-tabs :deep(.n-tabs-nav) {
  margin-bottom: 12px;
}

/* tab 切换淡入上移动画 */
.dashboard-tabs :deep(.n-tab-pane) {
  animation: dashboard-tab-in 0.28s ease;
}

@keyframes dashboard-tab-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dashboard-token-group {
  max-width: 560px;
  width: 100%;
}

.bind-captcha {
  margin-top: 14px;
}

.dashboard-profile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
}

.dashboard-profile__name {
  font-size: 20px;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.dashboard-profile__meta {
  font-size: 12px;
}
</style>
