<script setup lang="ts">
import { useAccount } from '@/api/account'
import { BiliAuthCodeStatusType, BiliAuthModel } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import EventFetcherStatusCard from '@/components/EventFetcherStatusCard.vue'
import { ACCOUNT_API_URL, TURNSTILE_KEY } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { Info24Filled, Mic24Filled, Question24Regular } from '@vicons/fluent'
import { useLocalStorage } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCard,
  NCode,
  NCountdown,
  NDivider,
  NEllipsis,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NModal,
  NPopconfirm,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage
} from 'naive-ui'
import { onUnmounted, ref } from 'vue'
import VueTurnstile from 'vue-turnstile'
import SettingsManageView from './SettingsManageView.vue'
import Setting_PaymentView from './Setting_PaymentView.vue'

const token = ref('')
const turnstile = ref()

const accountInfo = useAccount()
const useAuth = useAuthStore()
const cookie = useLocalStorage('JWT_Token', '')
const message = useMessage()

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

function logout() {
  cookie.value = undefined
  window.location.reload()
}
function resetBili() {
  isLoading.value = true
  QueryGetAPI(ACCOUNT_API_URL + 'reset-bili')
    .then((data) => {
      if (data.code == 200) {
        message.success('已解绑 Bilibili 主播账号')
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误')
    })
}
function resetBiliAuthBind() {
  isLoading.value = true
  QueryGetAPI(ACCOUNT_API_URL + 'reset-bili-auth')
    .then((data) => {
      if (data.code == 200) {
        message.success('已解绑 Bilibili 用户账号')
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误')
    })
}
function resetEmail() {
  isLoading.value = true
  QueryGetAPI(ACCOUNT_API_URL + 'reset-email', { email: newEmailAddress.value, code: newEmailVerifyCode.value })
    .then((data) => {
      if (data.code == 200) {
        message.success('已将邮箱改绑为 ' + newEmailAddress.value)
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误')
    })
}
function sendEmailVerifyCode() {
  QueryGetAPI(ACCOUNT_API_URL + 'reset-email/code', { email: newEmailAddress.value })
    .then((data) => {
      if (data.code == 200) {
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
      message.error('发生错误')
    })
}
async function resetPassword() {
  if (newPassword.value != newPassword2.value) {
    message.error('两次密码不一致')
    return
  }
  await QueryGetAPI(ACCOUNT_API_URL + 'verify/reset-password', { password: newPassword.value })
    .then(async (data) => {
      if (data.code == 200) {
        message.success('密码已修改')
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误')
    })
}
async function resetName() {
  if (accountInfo.value?.name == newName.value) {
    message.error('新用户名与旧用户名一致')
    return
  }
  isLoading.value = true
  await QueryGetAPI(ACCOUNT_API_URL + 'change-name', { name: newName.value })
    .then(async (data) => {
      if (data.code == 200) {
        message.success('用户名已修改')
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误')
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function resetToken() {
  isLoading.value = true
  await QueryPostAPI<string>(ACCOUNT_API_URL + 'reset-token')
    .then(async (data) => {
      if (data.code == 200) {
        message.success('已重新生成 Token')

        accountInfo.value.token = data.data
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误: ' + err)
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
  }>(ACCOUNT_API_URL + 'bind-bili', { code: biliCode.value }, [['Turnstile', token.value]])
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
  await QueryGetAPI<BiliAuthModel>(ACCOUNT_API_URL + 'bind-bili-auth', { token: biliAuthText.value })
    .then(async (data) => {
      if (data.code == 200) {
        message.success('已绑定用户: ' + data.data.userId)
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
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
  }>(ACCOUNT_API_URL + 'change-bili', { code: biliCode.value }, [['Turnstile', token.value]])
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
      message.error('发生错误')
    })
    .finally(() => {
      turnstile.value?.reset()
      isLoading.value = false
    })
}
onUnmounted(() => {
  turnstile.value?.remove()
})
</script>

<template>
  <NFlex justify="center" align="center" vertical>
    <NTabs type="segment" animated v-if="accountInfo" style="width: 100%;" :default-value="$route.query.tab?.toString() ?? 'info'">
      <NTabPane name="info" tab="个人信息" style="width: 100%;" display-directive="show:lazy">
        <NFlex justify="center" align="center">
          <NCard embedded style="width: 100%;max-width: 800px;">
            <NSpace align="center" justify="center" vertical>
              <NText style="font-size: 3rem">
                {{ accountInfo?.name }}
              </NText>
              <NText style="color: gray">
                于
                <NTime :time="accountInfo?.createAt" />
                注册
              </NText>
            </NSpace>
            <NDivider>
              <NText depth="3" style="font-size: 18px"> {{ accountInfo?.id }} </NText>
            </NDivider>
            <NSpace vertical>
              <NCard size="small">
                <NSpace :size="5">
                  邮箱:
                  <NEllipsis v-if="accountInfo?.isEmailVerified" style="max-width: 100%">
                    <NText style="color: var(--primary-color)"> 已认证 | {{ accountInfo?.bindEmail }} </NText>
                  </NEllipsis>
                  <template v-else>
                    <NTag type="error" size="small"> 未认证 </NTag>
                  </template>
                  <NButton v-if="accountInfo?.isEmailVerified" type="warning" size="tiny"
                    @click="resetEmailModalVisiable = true">
                    修改邮箱
                  </NButton>
                </NSpace>
              </NCard>
              <NCard size="small">
                主播 Bilibili 账户:
                <NEllipsis v-if="accountInfo?.isBiliVerified" style="max-width: 100%">
                  <NText style="color: var(--primary-color)">
                    <NSpace :size="5" align="center">
                      已认证 | {{ accountInfo?.biliId }}
                      <NTag v-if="accountInfo.biliAuthCodeStatus == BiliAuthCodeStatusType.Active" type="success"
                        size="small" :bordered="false">
                        身份码: 有效
                      </NTag>
                      <NTag v-else-if="accountInfo.biliAuthCodeStatus == BiliAuthCodeStatusType.Inactive" type="error"
                        size="small" :bordered="false">
                        身份码: 需更新
                      </NTag>
                      <NTag v-else-if="accountInfo.biliAuthCodeStatus == BiliAuthCodeStatusType.Notfound" type="warning"
                        size="small" :bordered="false">
                        身份码: 需绑定
                        <NTooltip>
                          <template #trigger>
                            <NIcon :component="Mic24Filled" />
                          </template>
                          如果你不是主播的话则不需要在意这个提示
                        </NTooltip>
                      </NTag>
                      <NButton size="tiny" type="info" @click="bindBiliCodeModalVisiable = true"> 更新身份码 </NButton>
                      <NPopconfirm @positive-click="resetBili">
                        <template #trigger>
                          <NButton size="tiny" type="error"> 解除认证 </NButton>
                        </template>
                        确定解除认证吗? 解除后现有的数据跟踪数据将被删除并且无法恢复
                      </NPopconfirm>
                    </NSpace>
                  </NText>
                </NEllipsis>
                <template v-else>
                  <NTag type="error" size="small">
                    未绑定
                    <NTooltip>
                      <template #trigger>
                        <NIcon :component="Info24Filled" />
                      </template>
                      如果你不是主播的话则不需要在意这个
                    </NTooltip>
                  </NTag>
                  <NDivider vertical />
                  <NButton size="small" @click="bindBiliCodeModalVisiable = true" type="info"> 进行绑定 </NButton>
                </template>
              </NCard>
              <NCard size="small">
                用户 Bilibili 账户:
                <NEllipsis v-if="accountInfo?.biliUserAuthInfo" style="max-width: 100%">
                  <NText style="color: var(--primary-color)">
                    <NSpace :size="5" align="center">
                      已绑定 | {{ accountInfo?.biliUserAuthInfo?.name }} [{{ accountInfo?.biliUserAuthInfo?.userId }}]
                      <NPopconfirm @positive-click="resetBiliAuthBind">
                        <template #trigger>
                          <NButton size="tiny" type="error"> 解除绑定 </NButton>
                        </template>
                        确定解除绑定吗?
                      </NPopconfirm>
                    </NSpace>
                  </NText>
                </NEllipsis>
                <template v-else>
                  <NTag type="error" size="small">
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
                  <NButton size="small" @click="bindBiliAuthModalVisiable = true" type="info"> 进行认证 </NButton>
                </template>
              </NCard>
              <EventFetcherStatusCard />
              <NAlert title="Token" type="info">
                请注意保管, 这个东西可以完全操作你的账号
                <NInputGroup>
                  <NInput type="password" :value="accountInfo?.token" show-password-on="click" status="error" />
                  <NPopconfirm @positive-click="resetToken">
                    <template #trigger>
                      <NButton type="error"> 重置 </NButton>
                    </template>
                    确定要重新生成 Token 吗? EventFetcher 等设施将需要重新部署
                  </NPopconfirm>
                </NInputGroup>
              </NAlert>
            </NSpace>
            <NDivider />
            <NSpace justify="center">
              <NButton type="info" @click="resetNameModalVisiable = true"> 修改用户名 </NButton>
              <NButton type="warning" @click="resetPasswordModalVisiable = true"> 修改密码 </NButton>
              <NPopconfirm @positive-click="logout">
                <template #trigger>
                  <NButton type="error"> 登出 </NButton>
                </template>
                确定登出?
              </NPopconfirm>
            </NSpace>
          </NCard>
        </NFlex>
      </NTabPane>
      <NTabPane name="setting" tab="设置" display-directive="show:lazy">
        <SettingsManageView />
      </NTabPane>
      <NTabPane name="payment" tab="增值" display-directive="show:lazy">
        <Setting_PaymentView />
      </NTabPane>
    </NTabs>
  </NFlex>
  <NModal v-model:show="resetEmailModalVisiable" preset="card" title="改绑邮箱" style="width: 400px; max-width: 90%">
    <NSpace vertical>
      <NInput v-model:value="newEmailAddress" placeholder="新邮箱地址" />
      <NInputGroup>
        <NInput v-model:value="newEmailVerifyCode" placeholder="验证码" />
        <NButton type="primary" @click="sendEmailVerifyCode">
          发送验证码 <template v-if="!canSendEmailVerifyCode"> |
            <NCountdown :duration="60000" />
          </template>
        </NButton>
      </NInputGroup>
    </NSpace>
    <template #footer>
      <NButton @click="resetEmail" type="primary"> 确定 </NButton>
    </template>
  </NModal>
  <NModal v-model:show="resetPasswordModalVisiable" preset="card" title="修改密码" style="width: 400px; max-width: 90%">
    <NSpace vertical>
      <NInput v-model:value="newPassword" type="password" placeholder="新密码" />
      <NInput v-model:value="newPassword2" type="password" placeholder="确认密码" />
    </NSpace>
    <template #footer>
      <NButton @click="resetPassword" type="warning"> 确定修改 </NButton>
    </template>
  </NModal>
  <NModal v-model:show="resetNameModalVisiable" preset="card" title="修改用户名" style="width: 400px; max-width: 90%">
    <NSpace vertical>
      <NInput v-model:value="newName" placeholder="新用户名" />
    </NSpace>
    <template #footer>
      <NButton @click="resetName" type="warning" :loading="isLoading"> 确定修改 </NButton>
    </template>
  </NModal>
  <NModal v-model:show="bindBiliCodeModalVisiable" preset="card" title="绑定/更新身份码" style="width: 400px; max-width: 90%">
    <NSpace vertical>
      <NInputGroup>
        <NInput v-model:value="biliCode" placeholder="身份码" />
        <NTooltip>
          <template #trigger>
            <NButton type="primary" tag="a" href="https://play-live.bilibili.com/" target="_blank">
              <template #icon>
                <NIcon>
                  <Question24Regular />
                </NIcon>
              </template>
              前往获取
            </NButton>
          </template>
          在幻星页面右侧或者开播页获取推流地址旁边可以复制身份码
        </NTooltip>
      </NInputGroup>
    </NSpace>

    <VueTurnstile ref="turnstile" :site-key="TURNSTILE_KEY" v-model="token" theme="auto" style="text-align: center" />
    <template #footer>
      <NButton @click="accountInfo?.isBiliVerified ? ChangeBili() : BindBili()" type="success"
        :loading="!token || isLoading">
        确定
      </NButton>
    </template>
  </NModal>
  <NModal v-model:show="bindBiliAuthModalVisiable" preset="card" title="绑定用户账户" style="width: 700px; max-width: 90%">
    <NSpace vertical>
      <NAlert title="获取认证链接" type="info">
        因为部分功能如积分兑换等也需要对没有注册本站账户的用户开放, 所以需要现在另一个页面获取认证链接,
        然后再回到这里绑定
      </NAlert>
      <NInputGroup>
        <NInput v-model:value="biliAuthText" placeholder="认证链接, 或者 Token" />
        <NTooltip>
          <template #trigger>
            <NButton type="primary" tag="a" href="/bili-auth" target="_blank">
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
    </NSpace>
    <template #footer>
      <NButton @click="BindBiliAuth()" type="success" :loading="isLoading" :disabled="!biliAuthText"> 确定 </NButton>
    </template>
  </NModal>
</template>
