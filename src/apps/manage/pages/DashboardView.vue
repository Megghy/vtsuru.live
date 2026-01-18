<script setup lang="ts">
import type { BiliAuthModel } from '@/api/api-models'
import { Info24Filled, Mic24Filled, Question24Regular } from '@vicons/fluent'
import { useRouteQuery } from '@vueuse/router'
import {
  NAlert, NButton, NCard, NCode, NCountdown, NDivider, NEllipsis, NFlex, NIcon, NInput, NInputGroup, NModal, NPopconfirm, NSelect, NTabPane, NTabs, NTag, NText, NTime, NTooltip, useMessage } from 'naive-ui';
import { onUnmounted, ref } from 'vue'
import VueTurnstile from 'vue-turnstile'
import { useRoute, useRouter } from 'vue-router'
import { useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import { ACCOUNT_API_URL, availableAPIs, CN_HOST, selectedAPIKey, TURNSTILE_KEY } from '@/shared/config'
import { checkUpdateNote } from '@/shared/services/UpdateNote'
import SettingPaymentView from '@/apps/manage/pages/settings/SettingPaymentView.vue'
import SettingsManageView from '@/apps/manage/pages/settings/SettingsManageView.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'

const token = ref('')
const turnstile = ref()

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const router = useRouter()

// 使用 useRouteQuery 自动同步 URL 查询参数
const selectedTab = useRouteQuery('tab', 'info', { transform: String })

watch(
  () => [selectedTab.value, route.query.setting] as const,
  ([tab, setting]) => {
    if (tab !== 'setting') return
    if (setting !== 'index') return
    router.replace({ name: 'manage-userPageBuilder', query: { mode: 'legacy' } })
  },
  { immediate: true },
)

const resetEmailModalVisiable = ref(false)
const resetPasswordModalVisiable = ref(false)
const bindBiliCodeModalVisiable = ref(false)
const bindBiliAuthModalVisiable = ref(false)
const resetNameModalVisiable = ref(false)

const newEmailAddress = ref('')
const newEmailVerifyCode = ref('')
const canSendEmailVerifyCode = ref(true)

const newName = ref('')

const newPassword = ref('')
const newPassword2 = ref('')
const biliCode = ref('')
const biliAuthText = ref('')
const isLoading = ref(false)

// API选择器选项
const apiOptions = availableAPIs.map(api => ({
  label: api.name,
  value: api.key,
}))

// 切换API
function handleAPIChange(value: string) {
  message.info(`正在切换到${availableAPIs.find(api => api.key === value)?.name}...`)
  setTimeout(() => {
    location.reload()
  }, 500)
}

function logout() {
  cookie.value = undefined
  window.location.reload()
}
function resetBili() {
  isLoading.value = true
  QueryGetAPI(`${ACCOUNT_API_URL}reset-bili`)
    .then((data) => {
      if (data.code === 200) {
        message.success('已解绑 Bilibili 主播账号')
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发生错误')
    })
}
function resetBiliAuthBind() {
  isLoading.value = true
  QueryGetAPI(`${ACCOUNT_API_URL}reset-bili-auth`)
    .then((data) => {
      if (data.code === 200) {
        message.success('已解绑 Bilibili 用户账号')
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发生错误')
    })
}
function resetEmail() {
  isLoading.value = true
  QueryGetAPI(`${ACCOUNT_API_URL}reset-email`, { email: newEmailAddress.value, code: newEmailVerifyCode.value })
    .then((data) => {
      if (data.code === 200) {
        message.success(`已将邮箱改绑为 ${newEmailAddress.value}`)
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发生错误')
    })
}
function sendEmailVerifyCode() {
  QueryGetAPI(`${ACCOUNT_API_URL}reset-email/code`, { email: newEmailAddress.value })
    .then((data) => {
      if (data.code === 200) {
        message.success('发送成功, 请检查目标邮箱. 如果没有收到, 请检查垃圾邮件')
        canSendEmailVerifyCode.value = false
        setTimeout(() => {
          canSendEmailVerifyCode.value = true
        }, 60 * 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发生错误')
    })
}
async function resetPassword() {
  if (newPassword.value !== newPassword2.value) {
    message.error('两次密码不一致')
    return
  }
  await QueryGetAPI(`${ACCOUNT_API_URL}verify/reset-password`, { password: newPassword.value })
    .then(async (data) => {
      if (data.code === 200) {
        message.success('密码已修改')
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发生错误')
    })
}
async function resetName() {
  if (accountInfo.value?.name === newName.value) {
    message.error('新用户名与旧用户名一致')
    return
  }
  isLoading.value = true
  await QueryGetAPI(`${ACCOUNT_API_URL}change-name`, { name: newName.value })
    .then(async (data) => {
      if (data.code === 200) {
        message.success('用户名已修改')
        setTimeout(() => {
          location.reload()
        }, 1000)
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
        setTimeout(() => {
          location.reload()
        }, 1000)
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
async function BindBiliAuth() {
  if (!biliAuthText.value) {
    message.error('认证链接不能为空')
    return
  }
  isLoading.value = true
  await QueryGetAPI<BiliAuthModel>(`${ACCOUNT_API_URL}bind-bili-auth`, { token: biliAuthText.value })
    .then(async (data) => {
      if (data.code == 200) {
        message.success(`已绑定用户: ${data.data.userId}`)
        setTimeout(() => {
          location.reload()
        }, 1000)
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
        setTimeout(() => {
          location.reload()
        }, 1000)
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
  <div class="dashboard-view">
    <ManagePageHeader title="面板" subtitle="账户与功能配置" />

    <div class="dashboard-alerts">
      <NAlert type="success" :bordered="false">
        本站新增国内镜像:
        <NButton text tag="a" :href="CN_HOST" target="_blank">
          {{ CN_HOST }}
        </NButton>, 访问更快
      </NAlert>

      <NAlert
        v-if="accountInfo?.biliAuthCodeStatus === BiliAuthCodeStatusType.Inactive"
        type="error"
        title="身份码已失效"
        :bordered="false"
      >
        <NFlex justify="space-between" align="center" wrap :size="12">
          <NText>你的身份码已失效, 这会导致无法获取直播间数据.</NText>
          <NButton size="small" type="error" @click="bindBiliCodeModalVisiable = true">
            更新身份码
          </NButton>
        </NFlex>
      </NAlert>
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
        style="width: 100%;"
        display-directive="show:lazy"
      >
        <NCard size="small" bordered :segmented="{ content: true }">
          <NFlex vertical :size="12">
            <NFlex justify="space-between" align="baseline" wrap :size="12">
              <div class="dashboard-profile">
                <NText strong class="dashboard-profile__name">
                  {{ accountInfo?.name }}
                </NText>
                <NText depth="3" class="dashboard-profile__meta">
                  注册于 <NTime :time="accountInfo?.createAt" />
                </NText>
              </div>
              <NFlex align="center" justify="end" wrap :size="8">
                <NText depth="3" code>
                  {{ accountInfo?.id }}
                </NText>
                <NButton
                  size="small"
                  secondary
                  @click="resetNameModalVisiable = true"
                >
                  修改用户名
                </NButton>
                <NButton
                  size="small"
                  secondary
                  @click="resetPasswordModalVisiable = true"
                >
                  修改密码
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
              <NCard size="small" bordered>
                <NFlex :size="5">
                  邮箱:
                  <NEllipsis
                    v-if="accountInfo?.isEmailVerified"
                    style="max-width: 100%"
                  >
                    <NText style="color: var(--n-primary-color)">
                      已认证 | {{ accountInfo?.bindEmail }}
                    </NText>
                  </NEllipsis>
                  <template v-else>
                    <NTag
                      type="error"
                      size="small"
                    >
                      未认证
                    </NTag>
                  </template>
                  <NButton
                    v-if="accountInfo?.isEmailVerified"
                    type="warning"
                    size="tiny"
                    @click="resetEmailModalVisiable = true"
                  >
                    修改邮箱
                  </NButton>
                </NFlex>
              </NCard>
              <NCard size="small" bordered>
                主播 Bilibili 账户:
                <NEllipsis
                  v-if="accountInfo?.isBiliVerified"
                  style="max-width: 100%"
                >
                  <NText style="color: var(--n-primary-color)">
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
              <NCard size="small" bordered>
                用户 Bilibili 账户:
                <NEllipsis
                  v-if="accountInfo?.biliUserAuthInfo"
                  style="max-width: 100%"
                >
                  <NText style="color: var(--n-primary-color)">
                    <NFlex
                      :size="5"
                      align="center"
                    >
                      已绑定 | {{ accountInfo?.biliUserAuthInfo?.name }} [{{ accountInfo?.biliUserAuthInfo?.userId }}]
                      <NPopconfirm @positive-click="resetBiliAuthBind">
                        <template #trigger>
                          <NButton
                            size="tiny"
                            type="error"
                          >
                            解除绑定
                          </NButton>
                        </template>
                        确定解除绑定吗?
                      </NPopconfirm>
                    </NFlex>
                  </NText>
                </NEllipsis>
                <template v-else>
                  <NTag
                    type="error"
                    size="small"
                  >
                    未认证
                    <NTooltip>
                      <template #trigger>
                        <NIcon :component="Info24Filled" />
                      </template>
                      用于进行积分兑换等操作, 如果你是主播可以不用管,
                      并且即使不绑定也可以直接用认证完成给出的链接查看和使用积分
                    </NTooltip>
                  </NTag>
                  <NDivider vertical />
                  <NButton
                    size="small"
                    type="info"
                    @click="bindBiliAuthModalVisiable = true"
                  >
                    进行认证
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
                请注意保管, 这个东西可以完全操作你的账号
                <NInputGroup class="dashboard-token-group">
                  <NInput
                    type="password"
                    :value="accountInfo?.token"
                    show-password-on="click"
                    status="error"
                  />
                  <NPopconfirm @positive-click="resetToken">
                    <template #trigger>
                      <NButton type="error" size="small">
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
              <NFlex align="center" :wrap="true" :size="12">
                <NText>当前使用的API:</NText>
                <NSelect
                  v-model:value="selectedAPIKey"
                  :options="apiOptions"
                  style="max-width: 220px;"
                  @update:value="handleAPIChange"
                />
                <NText depth="3" style="font-size: 12px;">
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
        name="billing"
        tab="增值"
        display-directive="show:lazy"
      >
        <SettingPaymentView />
      </NTabPane>
    </NTabs>
  </div>
  <NModal
    v-model:show="resetEmailModalVisiable"
    preset="card"
    title="改绑邮箱"
    style="width: 400px; max-width: 90%"
  >
    <NFlex vertical>
      <NInput
        v-model:value="newEmailAddress"
        placeholder="新邮箱地址"
      />
      <NInputGroup>
        <NInput
          v-model:value="newEmailVerifyCode"
          placeholder="验证码"
        />
        <NButton
          type="primary"
          @click="sendEmailVerifyCode"
        >
          发送验证码 <template v-if="!canSendEmailVerifyCode">
            |
            <NCountdown :duration="60000" />
          </template>
        </NButton>
      </NInputGroup>
    </NFlex>
    <template #footer>
      <NButton
        type="primary"
        @click="resetEmail"
      >
        确定
      </NButton>
    </template>
  </NModal>
  <NModal
    v-model:show="resetPasswordModalVisiable"
    preset="card"
    title="修改密码"
    style="width: 400px; max-width: 90%"
  >
    <NFlex vertical>
      <NInput
        v-model:value="newPassword"
        type="password"
        placeholder="新密码"
      />
      <NInput
        v-model:value="newPassword2"
        type="password"
        placeholder="确认密码"
      />
    </NFlex>
    <template #footer>
      <NButton
        type="warning"
        @click="resetPassword"
      >
        确定修改
      </NButton>
    </template>
  </NModal>
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
          在幻星页面右侧 或者 <NButton
            text
            tag="a"
            href="https://link.bilibili.com/p/center/index#/my-room/start-live"
            target="_blank"
            type="success"
          >
            开播页
          </NButton>直播信息处可以获取
          <br>
          刷新身份码后需要在这里更新
          <img
            src="https://files.vtsuru.suki.club/updatelog/dbc2b6fe-fc85-42f3-9167-78f15abe74ce.png"
            style="max-width: 400px; display: block; margin-top: 8px;"
          >
        </NTooltip>
      </NInputGroup>
    </NFlex>
    <NDivider />
    <VueTurnstile
      ref="turnstile"
      v-model="token"
      :site-key="TURNSTILE_KEY"
      theme="auto"
      style="text-align: center"
    />
    <template #footer>
      <NButton
        type="success"
        :loading="!token || isLoading"
        @click="accountInfo?.isBiliVerified ? ChangeBili() : BindBili()"
      >
        确定
      </NButton>
    </template>
  </NModal>
  <NModal
    v-model:show="bindBiliAuthModalVisiable"
    preset="card"
    title="绑定用户账户"
    style="width: 700px; max-width: 90%"
  >
    <NFlex vertical>
      <NAlert
        title="获取认证链接"
        type="info"
      >
        因为部分功能如积分兑换等也需要对没有注册本站账户的用户开放, 所以需要现在另一个页面获取认证链接,
        然后再回到这里绑定
      </NAlert>
      <NInputGroup>
        <NInput
          v-model:value="biliAuthText"
          placeholder="认证链接, 或者 Token"
        />
        <NTooltip>
          <template #trigger>
            <NButton
              type="primary"
              tag="a"
              href="/bili-auth"
              target="_blank"
            >
              <template #icon>
                <NIcon>
                  <Question24Regular />
                </NIcon>
              </template>
              前往认证
            </NButton>
          </template>
          直接粘贴认证完成后给出的类似
          <NCode> https://vtsuru.live/bili-user?auth=abcdefghijklmnopqrstuvwxyz== </NCode>
          的链接即可
        </NTooltip>
      </NInputGroup>
    </NFlex>
    <template #footer>
      <NButton
        type="success"
        :loading="isLoading"
        :disabled="!biliAuthText"
        @click="BindBiliAuth()"
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
}

.dashboard-alerts {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dashboard-tabs :deep(.n-tabs-nav) {
  margin-bottom: 12px;
}

.dashboard-token-group {
  max-width: 560px;
  width: 100%;
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
