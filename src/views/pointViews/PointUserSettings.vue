<script setup lang="ts">
import { AddressInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL, THINGS_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { useStorage } from '@vueuse/core'
import {
  FormRules,
  NButton,
  NCard,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NLayoutContent,
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NScrollbar,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NText,
  NTimeline,
  NTimelineItem,
  SelectOption,
  useMessage,
} from 'naive-ui'
import { computed, h, ref } from 'vue'
//@ts-ignore
import UserAgreement from '@/document/UserAgreement.md'
import AddressDisplay from '@/components/manage/AddressDisplay.vue'

type AreaData = {
  [province: string]: {
    [city: string]: {
      [district: string]: string[]
    }
  }
}

const useAuth = useAuthStore()
const message = useMessage()
const isLoading = ref(false)

const userAgree = ref(false)

const areas = useStorage<{
  createAt: number
  data: AreaData
}>('Data.Areas', {
  createAt: 0,
  data: {},
})
const provinceOptions = computed(() => {
  return Object.keys(areas.value?.data ?? {}).map((p) => ({ label: p, value: p }))
})
const cityOptions = (province: string) => {
  if (!areas.value?.data[province]) return []
  return Object.keys(areas.value?.data[province] ?? {}).map((c) => ({ label: c, value: c }))
}
const districtOptions = (province: string, city: string) => {
  if (!areas.value?.data[province]?.[city]) return []
  return Object.keys(areas.value?.data[province][city] ?? {}).map((d) => ({ label: d, value: d }))
}
const streetOptions = (province: string, city: string, district: string) => {
  if (!areas.value?.data[province]?.[city]?.[district]) return []
  return areas.value?.data[province][city][district]?.map((s) => ({ label: s, value: s })) ?? []
}
const rules: FormRules = {
  phone: {
    required: true,
    message: '请输入手机号',
  },
  address: {
    required: true,
    message: '请输入详细地址',
  },
  name: {
    required: true,
    message: '请输入收件人姓名',
  },
  area: {
    required: true,
    message: '请选择地区',
    validator: () => {
      if (currentAddress.value?.province && currentAddress.value?.city && currentAddress.value?.district) {
        return true
      }
      return false
    },
  },
  agreement: {
    required: true,
    message: '请阅读并同意用户协议',
    validator: () => {
      return userAgree.value
    },
  },
}
const formRef = ref()

const biliAuth = computed(() => useAuth.biliAuth)

const currentAddress = ref<AddressInfo>()

const showAddressModal = ref(false)
const showAgreementModal = ref(false)

async function updateAddress() {
  formRef.value
    ?.validate()
    .then(async () => {
      isLoading.value = true
      try {
        const data = await useAuth.QueryBiliAuthPostAPI<AddressInfo>(
          POINT_API_URL + 'user/update-address',
          currentAddress.value,
        )
        if (data.code == 200) {
          message.success('已保存')
          showAddressModal.value = false
          currentAddress.value = {} as AddressInfo
          if (biliAuth.value.address) {
            const index = biliAuth.value.address?.findIndex((a) => a.id == data.data.id) ?? -1
            if (index >= 0) {
              biliAuth.value.address[index] = data.data
            } else {
              biliAuth.value.address.push(data.data)
            }
          }
        } else {
          message.error('更新地址失败: ' + data.message)
          console.error(data)
        }
      } catch (err) {
        message.error('更新地址失败: ' + err)
        console.error(err)
      }
    })
    .catch(() => {
      message.error('信息未填写完成')
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function deleteAddress(id: string) {
  isLoading.value = true
  try {
    const data = await useAuth.QueryBiliAuthGetAPI(POINT_API_URL + 'user/del-address', { id })
    if (data.code == 200) {
      message.success('已删除')
      if (biliAuth.value.address) {
        biliAuth.value.address = biliAuth.value.address?.filter((a) => a.id != id)
      }
    } else {
      message.error('删除地址失败: ' + data.message)
      console.error(data)
    }
  } catch (err) {
    message.error('删除地址失败: ' + err)
    console.error(err)
  } finally {
    isLoading.value = false
  }
}
async function getArea() {
  if (areas.value && Date.now() - areas.value?.createAt < 1000 * 60 * 60 * 24 * 7) {
    return
  }
  try {
    isLoading.value = true
    const data = await fetch(THINGS_URL + 'area_data.json')
    if (data.ok) {
      const area = {
        createAt: Date.now(),
        data: await data.json(),
      }
      console.log(area)
      areas.value = area
    }
  } catch (err) {
    console.error(err)
    message.error('获取区域数据失败')
  }
  isLoading.value = false
}
async function onOpenAddressModal() {
  showAddressModal.value = true
  currentAddress.value = {} as AddressInfo
  await getArea()
}
function onAreaSelectChange(level: number) {
  if (!currentAddress.value) return
  const newValue = {} as AddressInfo
  switch (level) {
    case 0: {
      // @ts-ignore
      currentAddress.value.city = undefined
      // @ts-ignore
      currentAddress.value.district = undefined
      // @ts-ignore
      currentAddress.value.street = undefined
    }
    case 1: {
      // @ts-ignore
      currentAddress.value.district = undefined
      // @ts-ignore
      currentAddress.value.street = undefined
    }
    case 2: {
      // @ts-ignore
      currentAddress.value.street = undefined
    }
  }
}
function switchAuth(token: string) {
  if (token == useAuth.biliToken) {
    message.info('当前正在使用该账号')
    return
  }
  useAuth.setCurrentAuth(token)
  message.success('已切换账号')
}
</script>

<template>
  <NSpin :show="useAuth.isLoading">
    <NFlex justify="center" align="center">
      <NCard title="更多" embedded>
        <NCollapse>
          <NCollapseItem title="收货地址" name="1">
            <NFlex vertical>
              <NButton @click="onOpenAddressModal" type="primary"> 添加地址 </NButton>
              <NList size="small" bordered>
                <NListItem v-for="address in biliAuth.address" :key="address.id">
                  <AddressDisplay :address="address">
                    <template #actions>
                      <NButton
                        size="small"
                        @click="
                          () => {
                            currentAddress = address
                            showAddressModal = true
                          }
                        "
                        type="info"
                      >
                        修改
                      </NButton>
                      <NPopconfirm @positive-click="() => deleteAddress(address?.id ?? '')">
                        <template #trigger>
                          <NButton size="small" type="error"> 删除 </NButton>
                        </template>
                        确定要删除这个收货信息吗?
                      </NPopconfirm>
                    </template>
                  </AddressDisplay>
                </NListItem>
              </NList>
            </NFlex>
          </NCollapseItem>
        </NCollapse>
      </NCard>
      <NCard title="账号操作" embedded>
        <NDivider> 切换账号 </NDivider>
        <NList clickable bordered>
          <NListItem v-for="item in useAuth.biliTokens" :key="item.token" @click="switchAuth(item.token)">
            <NFlex align="center">
              <NTag v-if="useAuth.biliToken == item.token" type="info"> 当前账号 </NTag>
              {{ item.uId }}
            </NFlex>
          </NListItem>
        </NList>
      </NCard>
    </NFlex>
  </NSpin>
  <NModal
    v-model:show="showAddressModal"
    preset="card"
    style="width: 800px; max-width: 90vw; height: auto"
    title="添加/更新地址"
  >
    <NSpin v-if="currentAddress" :show="isLoading">
      <NForm ref="formRef" :model="currentAddress" :rules="rules">
        <NFormItem label="地址" path="area" required>
          <NFlex style="width: 100%">
            <NSelect
              v-model:value="currentAddress.province"
              :options="provinceOptions"
              @update:value="onAreaSelectChange(0)"
              placeholder="请选择省"
              style="width: 100px"
              filterable
            />
            <NSelect
              v-model:value="currentAddress.city"
              :key="currentAddress.province"
              :options="cityOptions(currentAddress.province)"
              :disabled="!currentAddress?.province"
              @update:value="onAreaSelectChange(1)"
              placeholder="请选择市"
              style="width: 100px"
              filterable
            />
            <NSelect
              v-model:value="currentAddress.district"
              :key="currentAddress.city"
              :options="districtOptions(currentAddress.province, currentAddress.city)"
              :disabled="!currentAddress?.city"
              @update:value="onAreaSelectChange(2)"
              placeholder="请选择区"
              style="width: 100px"
              filterable
            />
            <NSelect
              v-model:value="currentAddress.street"
              :key="currentAddress.district"
              :options="streetOptions(currentAddress.province, currentAddress.city, currentAddress.district)"
              :disabled="!currentAddress?.district"
              placeholder="请选择街道"
              style="width: 150px"
              filterable
            />
          </NFlex>
        </NFormItem>
        <NFormItem label="详细地址" path="address" required>
          <NInput v-model:value="currentAddress.address" placeholder="详细地址" type="textarea" />
        </NFormItem>
        <NFormItem label="联系电话" path="phone" required>
          <NInputNumber
            v-model:value="currentAddress.phone"
            placeholder="联系电话"
            :show-button="false"
            style="width: 200px"
          />
        </NFormItem>
        <NFormItem label="联系人" path="name" required>
          <NInput v-model:value="currentAddress.name" placeholder="联系人" style="max-width: 150px" />
        </NFormItem>
        <NFormItem label="用户协议" required>
          <NCheckbox v-model:checked="userAgree">
            阅读并同意本站
            <NButton text @click="showAgreementModal = true" type="info"> 用户协议 </NButton>
          </NCheckbox>
        </NFormItem>
        <NButton @click="updateAddress" type="info" :loading="isLoading"> 保存 </NButton>
      </NForm>
    </NSpin>
  </NModal>
  <NModal
    v-model:show="showAgreementModal"
    title="用户协议"
    preset="card"
    style="width: 800px; max-width: 90vw; height: 90vh"
  >
    <NScrollbar style="height: 80vh"> <UserAgreement /></NScrollbar>
  </NModal>
</template>
