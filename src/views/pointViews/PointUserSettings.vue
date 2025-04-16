<script setup lang="ts">
import { AddressInfo } from '@/api/api-models'
import AddressDisplay from '@/components/manage/AddressDisplay.vue'
import { CURRENT_HOST, POINT_API_URL, THINGS_URL } from '@/data/constants'
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
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NScrollbar,
  NSelect,
  NSpin,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'
//@ts-expect-error 导入有点问题
import UserAgreement from '@/document/UserAgreement.md'

// 地区数据类型定义
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
const showAddressModal = ref(false)
const showAgreementModal = ref(false)
const formRef = ref()
const currentAddress = ref<AddressInfo>()

// 本地存储区域数据
const areas = useStorage<{
  createAt: number
  data: AreaData
}>('Data.Areas', {
  createAt: 0,
  data: {},
})

// 计算属性：获取省份选项
const provinceOptions = computed(() => {
  return Object.keys(areas.value?.data ?? {}).map((p) => ({ label: p, value: p }))
})

// 计算属性：当前用户授权信息
const biliAuth = computed(() => useAuth.biliAuth)

// 获取城市选项
const cityOptions = (province: string) => {
  if (!areas.value?.data[province]) return []
  return Object.keys(areas.value?.data[province] ?? {}).map((c) => ({ label: c, value: c }))
}

// 获取区/县选项
const districtOptions = (province: string, city: string) => {
  if (!areas.value?.data[province]?.[city]) return []
  return Object.keys(areas.value?.data[province][city] ?? {}).map((d) => ({ label: d, value: d }))
}

// 获取街道选项
const streetOptions = (province: string, city: string, district: string) => {
  if (!areas.value?.data[province]?.[city]?.[district]) return []
  return areas.value?.data[province][city][district]?.map((s) => ({ label: s, value: s })) ?? []
}

// 表单验证规则
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

// 处理API错误的工具函数
const handleApiError = (action: string, err: any) => {
  message.error(`${action}失败: ${err}`)
  console.error(err)
}

// 地址管理相关函数
// 更新地址信息
async function updateAddress() {
  try {
    await formRef.value?.validate()
    isLoading.value = true

    const data = await useAuth.QueryBiliAuthPostAPI<AddressInfo>(
      POINT_API_URL + 'user/update-address',
      currentAddress.value,
    )

    if (data.code == 200) {
      message.success('已保存')
      showAddressModal.value = false

      // 更新本地地址列表
      if (biliAuth.value.address) {
        const index = biliAuth.value.address?.findIndex((a) => a.id == data.data.id) ?? -1
        if (index >= 0) {
          biliAuth.value.address[index] = data.data
        } else {
          biliAuth.value.address.push(data.data)
        }
      }

      currentAddress.value = {} as AddressInfo
    } else {
      handleApiError('更新地址', data.message)
    }
  } catch (err) {
    if (err instanceof Error) {
      handleApiError('更新地址', err)
    } else {
      message.error('信息未填写完成')
    }
  } finally {
    isLoading.value = false
  }
}

// 删除地址
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
      handleApiError('删除地址', data.message)
    }
  } catch (err) {
    handleApiError('删除地址', err)
  } finally {
    isLoading.value = false
  }
}

// 获取区域数据
async function getArea() {
  // 缓存一周内的数据，避免频繁请求
  if (areas.value && Date.now() - areas.value?.createAt < 1000 * 60 * 60 * 24 * 7) {
    return
  }

  try {
    isLoading.value = true
    const data = await fetch('https://oss.suki.club/vtsuru/area_data.json')
    if (data.ok) {
      const area = {
        createAt: Date.now(),
        data: await data.json(),
      }
      areas.value = area
    }
  } catch (err) {
    handleApiError('获取区域数据', err)
  } finally {
    isLoading.value = false
  }
}

// 打开地址编辑模态框
async function onOpenAddressModal() {
  showAddressModal.value = true
  currentAddress.value = {} as AddressInfo
  await getArea()
}

// 处理地区选择变化，级联清除下级选项
function onAreaSelectChange(level: number) {
  if (!currentAddress.value) return

  // 根据变化的级别清除下级数据
  switch (level) {
    case 0: // 省份变化，清除市区街道
      currentAddress.value.city = undefined
      currentAddress.value.district = undefined
      currentAddress.value.street = undefined
      break
    case 1: // 城市变化，清除区县街道
      currentAddress.value.district = undefined
      currentAddress.value.street = undefined
      break
    case 2: // 区县变化，清除街道
      currentAddress.value.street = undefined
      break
  }
}

// 账号管理相关函数
// 切换当前使用的授权账号
function switchAuth(token: string) {
  if (token == useAuth.biliToken) {
    message.info('当前正在使用该账号')
    return
  }
  useAuth.setCurrentAuth(token)
  message.success('已切换账号')
}

// 登出当前账号
function logout() {
  useAuth.logout()
}
</script>

<template>
  <NSpin :show="useAuth.isLoading">
    <NFlex
      justify="center"
      align="center"
    >
      <NCard
        title="更多"
        embedded
      >
        <NCollapse>
          <NCollapseItem
            title="收货地址"
            name="1"
          >
            <NFlex vertical>
              <NButton
                type="primary"
                @click="onOpenAddressModal"
              >
                添加地址
              </NButton>
              <NList
                size="small"
                bordered
              >
                <NListItem
                  v-for="address in biliAuth.address"
                  :key="address.id"
                >
                  <AddressDisplay :address="address">
                    <template #actions>
                      <NButton
                        size="small"
                        type="info"
                        @click="() => {
                          currentAddress = address
                          showAddressModal = true
                        }
                        "
                      >
                        修改
                      </NButton>
                      <NPopconfirm @positive-click="() => deleteAddress(address?.id ?? '')">
                        <template #trigger>
                          <NButton
                            size="small"
                            type="error"
                          >
                            删除
                          </NButton>
                        </template>
                        确定要删除这个收货信息吗?
                      </NPopconfirm>
                    </template>
                  </AddressDisplay>
                </NListItem>
              </NList>
            </NFlex>
          </NCollapseItem>
          <NCollapseItem
            title="登录链接"
            name="2"
          >
            <NInput
              type="textarea"
              :value="`${CURRENT_HOST}bili-user?auth=` + useAuth.biliToken"
              readonly
            />
          </NCollapseItem>
        </NCollapse>
      </NCard>
      <NCard
        title="账号操作"
        embedded
      >
        <NFlex>
          <NPopconfirm @positive-click="logout">
            <template #trigger>
              <NButton
                type="warning"
                size="small"
              >
                登出
              </NButton>
            </template>
            确定要登出吗?
          </NPopconfirm>
        </NFlex>
        <NDivider> 切换账号 </NDivider>
        <NList
          clickable
          bordered
        >
          <NListItem
            v-for="item in useAuth.biliTokens"
            :key="item.token"
            @click="switchAuth(item.token)"
          >
            <NFlex align="center">
              <NTag
                v-if="useAuth.biliToken == item.token"
                type="info"
              >
                当前账号
              </NTag>
              {{ item.name }}
              <NDivider
                vertical
                style="margin: 0"
              />
              <NText depth="3">
                {{ item.uId }}
              </NText>
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
    <NSpin
      v-if="currentAddress"
      :show="isLoading"
    >
      <NForm
        ref="formRef"
        :model="currentAddress"
        :rules="rules"
      >
        <NFormItem
          label="地址"
          path="area"
          required
        >
          <NFlex style="width: 100%">
            <NSelect
              v-model:value="currentAddress.province"
              :options="provinceOptions"
              placeholder="请选择省"
              style="width: 100px"
              filterable
              @update:value="onAreaSelectChange(0)"
            />
            <NSelect
              :key="currentAddress.province"
              v-model:value="currentAddress.city"
              :options="cityOptions(currentAddress.province)"
              :disabled="!currentAddress?.province"
              placeholder="请选择市"
              style="width: 100px"
              filterable
              @update:value="onAreaSelectChange(1)"
            />
            <NSelect
              :key="currentAddress.city"
              v-model:value="currentAddress.district"
              :options="currentAddress.city ? districtOptions(currentAddress.province, currentAddress.city) : []"
              :disabled="!currentAddress?.city"
              placeholder="请选择区"
              style="width: 100px"
              filterable
              @update:value="onAreaSelectChange(2)"
            />
            <NSelect
              :key="currentAddress.district"
              v-model:value="currentAddress.street"
              :options="currentAddress.city && currentAddress.district ? streetOptions(currentAddress.province, currentAddress.city, currentAddress.district) : []"
              :disabled="!currentAddress?.district"
              placeholder="请选择街道"
              style="width: 150px"
              filterable
            />
          </NFlex>
        </NFormItem>
        <NFormItem
          label="详细地址"
          path="address"
          required
        >
          <NInput
            v-model:value="currentAddress.address"
            placeholder="详细地址"
            type="textarea"
          />
        </NFormItem>
        <NFormItem
          label="联系电话"
          path="phone"
          required
        >
          <NInputNumber
            v-model:value="currentAddress.phone"
            placeholder="联系电话"
            :show-button="false"
            style="width: 200px"
          />
        </NFormItem>
        <NFormItem
          label="联系人"
          path="name"
          required
        >
          <NInput
            v-model:value="currentAddress.name"
            placeholder="联系人"
            style="max-width: 150px"
          />
        </NFormItem>
        <NFormItem
          label="用户协议"
          required
        >
          <NCheckbox v-model:checked="userAgree">
            阅读并同意本站
            <NButton
              text
              type="info"
              @click="showAgreementModal = true"
            >
              用户协议
            </NButton>
          </NCheckbox>
        </NFormItem>
        <NButton
          type="info"
          :loading="isLoading"
          @click="updateAddress"
        >
          保存
        </NButton>
      </NForm>
    </NSpin>
  </NModal>
  <NModal
    v-model:show="showAgreementModal"
    title="用户协议"
    preset="card"
    style="width: 800px; max-width: 90vw; height: 90vh"
  >
    <NScrollbar style="height: 80vh">
      <UserAgreement />
    </NScrollbar>
  </NModal>
</template>
