<script setup lang="ts">
import { DisableFunction, EnableFunction, useAccount } from '@/api/account'
import { ResponsePointGoodModel, FunctionTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { NAlert, NButton, NDivider, NModal, NSwitch, NTabPane, NTabs, NText, useMessage } from 'naive-ui'
import { ref } from 'vue'

const message = useMessage()
const accountInfo = useAccount()

const goods = ref<ResponsePointGoodModel[]>(await getGoods())

async function getGoods() {
  try {
    var resp = await QueryGetAPI<ResponsePointGoodModel[]>(POINT_API_URL + 'get-goods')
    if (resp.code == 200) {
      return resp.data
    } else {
      message.error('无法获取数据: ' + resp.message)
    }
  } catch (err) {
    message.error('无法获取数据: ' + err)
  }
  return []
}
async function setFunctionEnable(enable: boolean) {
  let success = false
  if (enable) {
    success = await EnableFunction(FunctionTypes.Point)
  } else {
    success = await DisableFunction(FunctionTypes.Point)
  }
  if (success) {
    message.success('已' + (enable ? '启用' : '禁用') + '积分系统')
  } else {
    message.error('无法' + (enable ? '启用' : '禁用') + '积分系统')
  }
}
</script>

<template>
  <NAlert type="info">
    启用积分系统
    <NSwitch :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.Point)" @update:value="setFunctionEnable" />
    <br />
    <NText depth="3">
      此功能需要部署
      <NButton text type="primary" tag="a" href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p" target="_blank"> VtsuruEventFetcher </NButton>
    </NText>
  </NAlert>
  <NTabs>
    <NTabPane name="goods" tab="商品">
      <NDivider />
    </NTabPane>
  </NTabs>

  <NModal> </NModal>
</template>
