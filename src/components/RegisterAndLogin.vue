<script setup lang="ts">
import { GetSelfAccount } from '@/api/account'
import { AccountInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL, TURNSTILE_KEY } from '@/data/constants'
import { GetNotifactions } from '@/data/notifactions'
import { useLocalStorage } from '@vueuse/core'
import { FormInst, FormItemInst, FormItemRule, FormRules, NAlert, NButton, NCard, NDivider, NForm, NFormItem, NInput, NSpace, NSpin, NTab, NTabPane, NTabs, useMessage } from 'naive-ui'
import { ref } from 'vue'
import VueTurnstile from 'vue-turnstile'

interface RegisterModel {
  username: string
  email: string
  password: string
  reenteredPassword: string
}
interface LoginModel {
  account: string
  password: string
}

const message = useMessage()

const isRegister = ref(false)
const isLoading = ref(false)

const registerModel = ref<RegisterModel>({} as RegisterModel)
const loginModel = ref<LoginModel>({} as LoginModel)
const token = ref('')
const turnstile = ref()
const cookie = useLocalStorage('JWT_Token', '')

const formRef = ref<FormInst | null>(null)
const rPasswordFormItemRef = ref<FormItemInst | null>(null)
const registerRules: FormRules = {
  username: [
    {
      required: true,
      message: '请输入用户名',
    },
  ],
  email: [
    {
      required: true,
      message: '请输入邮箱',
    },
  ],
  password: [
    {
      required: true,
      message: '请输入密码',
    },
  ],
  reenteredPassword: [
    {
      required: true,
      message: '请再次输入密码',
      trigger: ['input', 'blur'],
    },
    {
      validator: validatePasswordStartWith,
      message: '两次密码输入不一致',
      trigger: 'input',
    },
    {
      validator: validatePasswordSame,
      message: '两次密码输入不一致',
      trigger: ['blur', 'password-input'],
    },
  ],
}
const loginRules: FormRules = {
  account: [
    {
      required: true,
      message: '请输入用户名或邮箱',
    },
  ],
  password: [
    {
      required: true,
      message: '请输入密码',
    },
  ],
}
function validatePasswordStartWith(rule: FormItemRule, value: string): boolean {
  return !!registerModel.value.password && registerModel.value.password.startsWith(value) && registerModel.value.password.length >= value.length
}
function validatePasswordSame(rule: FormItemRule, value: string): boolean {
  return value === registerModel.value.password
}
function onPasswordInput() {
  if (registerModel.value.reenteredPassword) {
    rPasswordFormItemRef.value?.validate({ trigger: 'password-input' })
  }
}
function onregisterButtonClick() {
  formRef.value?.validate().then(async () => {
    isLoading.value = true
    await QueryPostAPI<string>(
      ACCOUNT_API_URL + 'register',
      {
        name: registerModel.value.username,
        email: registerModel.value.email,
        password: registerModel.value.password,
      },
      [['Turnstile', token.value]]
    )
      .then((data) => {
        if (data.code == 200) {
          message.success(`注册成功`)
          cookie.value = data.data
          setTimeout(() => {
            location.reload()
          }, 1000)
        } else {
          message.error(data.message)
        }
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => {
        isLoading.value = false
        turnstile.value?.reset()
      })
  })
}
function onLoginButtonClick() {
  formRef.value?.validate().then(async () => {
    isLoading.value = true
    await QueryPostAPI<{
      account: AccountInfo
      token: string
    }>(
      ACCOUNT_API_URL + 'login',
      {
        nameOrEmail: loginModel.value.account,
        password: loginModel.value.password,
      },
    )
      .then(async (data) => {
        if (data.code == 200) {
          localStorage.setItem('JWT_Token', data.data.token)
          message.success(`成功登陆为 ${data?.data.account.name}`)
          setTimeout(() => {
            location.reload()
          }, 1000)
        } else {
          message.error(data.message)
        }
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => {
        isLoading.value = false
        turnstile.value?.reset()
      })
  })
}
</script>

<template>
  <NCard embedded>
    <template #header-extra>
      <slot name="header-extra"> </slot>
    </template>
    <template v-if="cookie">
      <NAlert type="warning"> 你已经登录 </NAlert>
    </template>
    <template v-else>
      <NTabs default-value="login" size="large" animated pane-wrapper-style="margin: 0 -4px" pane-style="padding-left: 4px; padding-right: 4px; box-sizing: border-box;">
        <NTabPane name="login" tab="登陆">
          <NForm ref="formRef" :rules="loginRules" :model="loginModel">
            <NFormItem path="account" label="用户名或邮箱">
              <NInput v-model:value="loginModel.account" />
            </NFormItem>
            <NFormItem path="password" label="密码">
              <NInput v-model:value="loginModel.password" type="password" @input="onPasswordInput" @keydown.enter="onLoginButtonClick" />
            </NFormItem>
          </NForm>
          <NSpace vertical justify="center" align="center">
            <NButton :loading="isLoading" type="primary" size="large" @click="onLoginButtonClick"> 登陆 </NButton>
          </NSpace>
        </NTabPane>
        <NTabPane name="register" tab="注册">
          <NForm ref="formRef" :rules="registerRules" :model="registerModel">
            <NFormItem path="username" label="用户名">
              <NInput v-model:value="registerModel.username" />
            </NFormItem>
            <NFormItem path="email" label="邮箱">
              <NInput v-model:value="registerModel.email" />
            </NFormItem>
            <NFormItem path="password" label="密码">
              <NInput v-model:value="registerModel.password" type="password" @input="onPasswordInput" @keydown.enter.prevent />
            </NFormItem>
            <NFormItem ref="rPasswordFormItemRef" first path="reenteredPassword" label="重复密码">
              <NInput v-model:value="registerModel.reenteredPassword" :disabled="!registerModel.password" type="password" @keydown.enter="onregisterButtonClick" />
            </NFormItem>
          </NForm>
          <NSpace vertical justify="center" align="center">
            <NButton :loading="!token || isLoading" type="primary" size="large" @click="onregisterButtonClick"> 注册 </NButton>
          </NSpace>

          <VueTurnstile ref="turnstile" :site-key="TURNSTILE_KEY" v-model="token" theme="auto" style="text-align: center" />
        </NTabPane>
      </NTabs>
    </template>
  </NCard>
</template>
