<script setup lang="ts">
import { FormInst, FormItemInst, FormItemRule, FormRules, NButton, NCard, NForm, NFormItem, NInput, NSpace } from 'naive-ui'
import { ref } from 'vue'

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

const registerModel = ref<RegisterModel>({} as RegisterModel)
const loginModel = ref<LoginModel>({} as LoginModel)

const formRef = ref<FormInst | null>(null)
const rPasswordFormItemRef = ref<FormItemInst | null>(null)
const rules: FormRules = {
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
</script>

<template>
  <NCard embedded>
    <template #header>
      <Transition name="fade" mode="out-in">
        <span v-if="isRegister"> 注册 </span>
        <span v-else> 登陆 </span>
      </Transition>
    </template>
    <Transition name="scale" mode="out-in">
      <div v-if="isRegister">
        <NForm ref="formRef" :rules="rules" :model="registerModel">
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
        <NButton @click="isRegister = false"> 或者现在去登陆 </NButton>
      </div>
      <div v-else>
        <NForm ref="formRef" :rules="rules" :model="registerModel">
          <NFormItem path="account" label="用户名或邮箱">
            <NInput v-model:value="loginModel.account" />
          </NFormItem>
          <NFormItem path="password" label="密码">
            <NInput v-model:value="loginModel.password" type="password" @input="onPasswordInput" @keydown.enter.prevent />
          </NFormItem>
        </NForm>
        <NSpace vertical justify="center" align="center">
          <NButton type="primary" size="large"> 登陆 </NButton>
          <NButton @click="isRegister = true" size="small" text> 或者现在去注册 </NButton>
        </NSpace>
      </div>
    </Transition>
  </NCard>
</template>
