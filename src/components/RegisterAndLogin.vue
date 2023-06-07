<script setup lang="ts">
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/data/constants'
import { FormInst, FormItemInst, FormItemRule, FormRules, NButton, NCard, NForm, NFormItem, NInput, NSpace, NSpin } from 'naive-ui'
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

const isRegister = ref(false)
const isLoading = ref(false)

const registerModel = ref<RegisterModel>({} as RegisterModel)
const loginModel = ref<LoginModel>({} as LoginModel)
const token = ref()

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
function onregisterButtonClick(e: MouseEvent) {
  e.preventDefault()
  isLoading.value = true
  formRef.value?.validate().then(async () => {
    await QueryPostAPI(
      ACCOUNT_API_URL + 'register',
      {
        name: registerModel.value.username,
        email: registerModel.value.email,
        password: registerModel.value.password,
      },
      {
        Turnstile: token.value,
      }
    )
      .then((data) => {
        if (data.code == 200) {
        }
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => {
        isLoading.value = false
      })
  })
}
function onLoginButtonClick(e: MouseEvent) {
  e.preventDefault()
  isLoading.value = true
  formRef.value?.validate().then(async () => {
    await QueryPostAPI(
      ACCOUNT_API_URL + 'login',
      {
        nameOrEmail: loginModel.value.account,
        password: loginModel.value.password,
      },
      {
        Turnstile: token.value,
      }
    )
      .then((data) => {
        if (data.code == 200) {
        }
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => {
        isLoading.value = false
      })
  })
}
</script>

<template>
  <NSpin :show="isLoading">
    <NCard embedded>
      <template #header>
        <Transition name="fade" mode="out-in">
          <span v-if="isRegister"> 注册 </span>
          <span v-else> 登陆 </span>
        </Transition>
      </template>
      <Transition name="scale" mode="out-in">
        <div v-if="isRegister">
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
              <NInput v-model:value="registerModel.reenteredPassword" :disabled="!registerModel.password" type="password" @keydown.enter.prevent />
            </NFormItem>
          </NForm>
          <NSpace vertical justify="center" align="center">
            <NButton type="primary" size="large" @click="onregisterButtonClick"> 注册 </NButton>
            <NButton @click="isRegister = false" size="small" text> 或者现在去登陆 </NButton>
          </NSpace>
        </div>
        <div v-else>
          <NForm ref="formRef" :rules="loginRules" :model="loginModel">
            <NFormItem path="account" label="用户名或邮箱">
              <NInput v-model:value="loginModel.account" />
            </NFormItem>
            <NFormItem path="password" label="密码">
              <NInput v-model:value="loginModel.password" type="password" @input="onPasswordInput" @keydown.enter.prevent />
            </NFormItem>
          </NForm>
          <NSpace vertical justify="center" align="center">
            <NButton type="primary" size="large" @click="onLoginButtonClick"> 登陆 </NButton>
            <NButton @click="isRegister = true" size="small" text> 或者现在去注册 </NButton>
          </NSpace>
        </div>
      </Transition>
      <VueTurnstile site-key="0x4AAAAAAAETUSAKbds019h0" v-model="token" theme="auto" style="text-align: center" />
    </NCard>
  </NSpin>
</template>
