<script setup lang="ts">
import { useAccount } from '@/api/account'
import { NAlert, NButton, NCard, NCountdown, NDivider, NEllipsis, NInput, NInputGroup, NModal, NPopconfirm, NSpace, NTag, NText, NThing, NTime, useMessage } from 'naive-ui'
import SettingsManageView from './SettingsManageView.vue'
import { useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/data/constants'

const accountInfo = useAccount()
const cookie = useLocalStorage('JWT_Token', '')
const message = useMessage()

const resetEmailModalVisiable = ref(false)
const resetPasswordModalVisiable = ref(false)

const newEmailAddress = ref('')
const newEmailVerifyCode = ref('')
const canSendEmailVerifyCode = ref(true)

const oldPassword = ref('')
const newPassword = ref('')
const newPassword2 = ref('')
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
        message.success('已解绑 Bilibili 账号')
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
      console.error(err)
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
      console.error(err)
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
      console.error(err)
      message.error('发生错误')
    })
}
</script>

<template>
  <NSpace justify="center" align="center" vertical style="width: 100%">
    <NCard embedded style="width: 100%">
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

      <NDivider />
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
            <NButton v-if="accountInfo?.isEmailVerified" type="warning" size="tiny" @click="resetEmailModalVisiable = true"> 修改邮箱 </NButton>
          </NSpace>
        </NCard>
        <NCard size="small">
          Bilibili 账户:
          <NEllipsis v-if="accountInfo?.isBiliVerified" style="max-width: 100%">
            <NText style="color: var(--primary-color)">
              <NSpace :size="5" align="center">
                已认证 | {{ accountInfo?.biliId }}
                <NPopconfirm @positive-click="resetBili">
                  <template #trigger>
                    <NButton size="tiny" type="error"> 解除绑定 </NButton>
                  </template>
                  确定解除绑定吗? 解绑后现有的数据跟踪数据将被删除并且无法恢复
                </NPopconfirm>
              </NSpace>
            </NText>
          </NEllipsis>
          <template v-else>
            <NTag type="error" size="small"> 未认证 </NTag>
            <NDivider vertical />
            <NButton size="small" @click="$router.push({ name: 'manage-biliVerify' })" type="info"> 前往认证 </NButton>
          </template>
        </NCard>
        <NAlert title="Token" type="info">
          请注意保管, 这个东西可以完全操作你的账号
          <NInput type="password" :value="accountInfo?.token" show-password-on="click" status="error" />
        </NAlert>
      </NSpace>
      <NDivider />
      <NSpace justify="center">
        <NButton type="warning" @click="resetPasswordModalVisiable = true"> 修改密码 </NButton>
        <NPopconfirm @positive-click="logout">
          <template #trigger>
            <NButton type="error"> 登出 </NButton>
          </template>
          确定登出?
        </NPopconfirm>
      </NSpace>
    </NCard>
  </NSpace>
  <div>
    <NDivider />
    <SettingsManageView />
    <NDivider />
  </div>
  <NModal v-model:show="resetEmailModalVisiable" preset="card" title="改绑邮箱" style="width: 400px; max-width: 90%">
    <NSpace vertical>
      <NInput v-model:value="newEmailAddress" placeholder="新邮箱地址" />
      <NInputGroup>
        <NInput v-model:value="newEmailVerifyCode" placeholder="验证码" />
        <NButton type="primary" @click="sendEmailVerifyCode">
          发送验证码 <template v-if="!canSendEmailVerifyCode"> | <NCountdown :duration="60000" /> </template>
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
</template>
