<script setup lang="ts">
import { Add24Regular, Delete24Regular, Edit24Regular, Location24Regular } from '@vicons/fluent'
import type { FormInst, FormRules } from 'naive-ui'
import {
  NButton,
  NCheckbox,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpin,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'

import type { AddressInfo } from '@/api/api-models'
import AddressDisplay from '@/shared/components/points/AddressDisplay.vue'
import { POINT_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useBiliAuth } from '@/store/useBiliAuth'

interface AreaData {
  [province: string]: {
    [city: string]: {
      [district: string]: string[]
    }
  }
}

interface AddressDraft extends Omit<AddressInfo, 'phone'> {
  phone: number | null
}

const emit = defineEmits<{ showAgreement: [] }>()
const auth = useBiliAuth()
const message = useMessage()
const formRef = ref<FormInst>()
const editing = ref(false)
const saving = ref(false)
const loadingArea = ref(false)
const agreed = ref(false)
const draft = ref(createAddressDraft())
const areas = usePersistedStorage<{ createAt: number; data: AreaData }>('Data.Areas', {
  createAt: 0,
  data: {},
})

const addresses = computed(() => auth.biliAuth.address ?? [])
const provinceOptions = computed(() => toOptions(Object.keys(areas.value.data)))
const cityOptions = computed(() => toOptions(Object.keys(areas.value.data[draft.value.province] ?? {})))
const districtOptions = computed(() =>
  toOptions(Object.keys(areas.value.data[draft.value.province]?.[draft.value.city ?? ''] ?? {})),
)
const streetOptions = computed(() =>
  toOptions(areas.value.data[draft.value.province]?.[draft.value.city ?? '']?.[draft.value.district ?? ''] ?? []),
)

const rules: FormRules = {
  province: { required: true, message: '请选择省份', trigger: ['blur', 'change'] },
  city: { required: true, message: '请选择城市', trigger: ['blur', 'change'] },
  district: { required: true, message: '请选择区县', trigger: ['blur', 'change'] },
  address: { required: true, message: '请输入详细地址', trigger: ['input', 'blur'] },
  phone: { required: true, type: 'number', message: '请输入联系电话', trigger: ['input', 'blur'] },
  name: { required: true, message: '请输入收件人姓名', trigger: ['input', 'blur'] },
}

function createAddressDraft(address?: AddressInfo): AddressDraft {
  return {
    id: address?.id,
    province: address?.province ?? '',
    city: address?.city,
    district: address?.district,
    street: address?.street,
    address: address?.address ?? '',
    phone: address?.phone ?? null,
    name: address?.name ?? '',
  }
}

function toOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }))
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function loadAreas() {
  if (Date.now() - areas.value.createAt < 7 * 24 * 60 * 60 * 1000) return

  loadingArea.value = true
  try {
    const response = await fetch('https://oss.suki.club/vtsuru/area_data.json')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    areas.value = { createAt: Date.now(), data: (await response.json()) as AreaData }
  } catch (error) {
    message.error(`地区数据加载失败：${errorText(error)}`)
  } finally {
    loadingArea.value = false
  }
}

async function openEditor(address?: AddressInfo) {
  draft.value = createAddressDraft(address)
  agreed.value = false
  editing.value = true
  await loadAreas()
}

function changeProvince() {
  draft.value.city = undefined
  draft.value.district = undefined
  draft.value.street = undefined
}

function changeCity() {
  draft.value.district = undefined
  draft.value.street = undefined
}

function changeDistrict() {
  draft.value.street = undefined
}

async function saveAddress() {
  try {
    await formRef.value?.validate()
  } catch {
    message.warning('请完整填写收货信息')
    return
  }
  if (!agreed.value) {
    message.warning('请先阅读并同意用户协议')
    return
  }

  saving.value = true
  try {
    const payload = { ...draft.value, phone: draft.value.phone as number }
    const response = await auth.QueryBiliAuthPostAPI<AddressInfo>(`${POINT_API_URL}user/update-address`, payload)
    if (response.code !== 200) throw new Error(response.message)

    const current = auth.biliAuth.address ?? []
    const index = current.findIndex((item) => item.id === response.data.id)
    auth.biliAuth.address = index < 0 ? [...current, response.data] : current.toSpliced(index, 1, response.data)
    editing.value = false
    message.success('收货地址已保存')
  } catch (error) {
    message.error(`保存失败：${errorText(error)}`)
  } finally {
    saving.value = false
  }
}

async function deleteAddress(address: AddressInfo) {
  if (!address.id) {
    message.error('该地址缺少标识，无法删除')
    return
  }

  saving.value = true
  try {
    const response = await auth.QueryBiliAuthGetAPI(`${POINT_API_URL}user/del-address`, { id: address.id })
    if (response.code !== 200) throw new Error(response.message)
    auth.biliAuth.address = addresses.value.filter((item) => item.id !== address.id)
    message.success('收货地址已删除')
  } catch (error) {
    message.error(`删除失败：${errorText(error)}`)
  } finally {
    saving.value = false
  }
}

function reset() {
  editing.value = false
  agreed.value = false
  draft.value = createAddressDraft()
}

defineExpose({ reset })
</script>

<template>
  <section class="point-settings__panel">
    <div class="point-settings__panel-header">
      <div class="point-settings__panel-title">
        <span class="point-settings__panel-icon"><NIcon :component="Location24Regular" /></span>
        <div>
          <h2>收货地址</h2>
          <span>{{ addresses.length }} 个地址</span>
        </div>
      </div>
      <NButton
        type="primary"
        secondary
        size="small"
        @click="openEditor()"
      >
        <template #icon><NIcon :component="Add24Regular" /></template>
        添加地址
      </NButton>
    </div>

    <NSpin :show="saving">
      <NEmpty
        v-if="addresses.length === 0"
        size="small"
        class="point-settings__empty"
      >
        <template #extra>
          <NButton
            size="small"
            @click="openEditor()"
          >
            添加第一个地址
          </NButton>
        </template>
      </NEmpty>

      <div
        v-else
        class="point-settings__address-grid"
      >
        <article
          v-for="address in addresses"
          :key="address.id"
          class="point-settings__address"
        >
          <AddressDisplay :address="address" />
          <div class="point-settings__row-actions">
            <NButton
              quaternary
              size="tiny"
              @click="openEditor(address)"
            >
              <template #icon><NIcon :component="Edit24Regular" /></template>
              编辑
            </NButton>
            <NPopconfirm @positive-click="deleteAddress(address)">
              <template #trigger>
                <NButton
                  quaternary
                  type="error"
                  size="tiny"
                >
                  <template #icon><NIcon :component="Delete24Regular" /></template>
                  删除
                </NButton>
              </template>
              确认删除这个收货地址？
            </NPopconfirm>
          </div>
        </article>
      </div>
    </NSpin>
  </section>

  <NModal
    v-model:show="editing"
    preset="card"
    :title="draft.id ? '编辑收货地址' : '添加收货地址'"
    class="point-settings__address-modal"
  >
    <NSpin :show="loadingArea">
      <NForm
        ref="formRef"
        :model="draft"
        :rules="rules"
        label-placement="top"
      >
        <div class="point-settings__area-fields">
          <NFormItem
            label="省份"
            path="province"
          >
            <NSelect
              v-model:value="draft.province"
              :options="provinceOptions"
              filterable
              placeholder="选择省份"
              @update:value="changeProvince"
            />
          </NFormItem>
          <NFormItem
            label="城市"
            path="city"
          >
            <NSelect
              v-model:value="draft.city"
              :options="cityOptions"
              :disabled="!draft.province"
              filterable
              placeholder="选择城市"
              @update:value="changeCity"
            />
          </NFormItem>
          <NFormItem
            label="区县"
            path="district"
          >
            <NSelect
              v-model:value="draft.district"
              :options="districtOptions"
              :disabled="!draft.city"
              filterable
              placeholder="选择区县"
              @update:value="changeDistrict"
            />
          </NFormItem>
          <NFormItem label="街道">
            <NSelect
              v-model:value="draft.street"
              :options="streetOptions"
              :disabled="!draft.district"
              filterable
              clearable
              placeholder="选择街道"
            />
          </NFormItem>
        </div>

        <NFormItem
          label="详细地址"
          path="address"
        >
          <NInput
            v-model:value="draft.address"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="楼栋、单元和门牌号"
          />
        </NFormItem>

        <div class="point-settings__contact-fields">
          <NFormItem
            label="收件人"
            path="name"
          >
            <NInput
              v-model:value="draft.name"
              placeholder="收件人姓名"
            />
          </NFormItem>
          <NFormItem
            label="联系电话"
            path="phone"
          >
            <NInputNumber
              v-model:value="draft.phone"
              :show-button="false"
              placeholder="联系电话"
              class="point-settings__phone"
            />
          </NFormItem>
        </div>

        <NCheckbox v-model:checked="agreed">
          我已阅读并同意
          <NButton
            text
            type="primary"
            @click.prevent="emit('showAgreement')"
          >
            用户协议
          </NButton>
        </NCheckbox>

        <div class="point-settings__modal-actions">
          <NButton @click="editing = false">取消</NButton>
          <NButton
            type="primary"
            :loading="saving"
            @click="saveAddress"
          >
            保存地址
          </NButton>
        </div>
      </NForm>
    </NSpin>
  </NModal>
</template>
