<script setup lang="ts">
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
const toast = useToast()
const editing = ref(false)
const saving = ref(false)
const loadingArea = ref(false)
const agreed = ref(false)
const draft = ref(createAddressDraft())
const addressToDelete = ref<AddressInfo>()
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

function draftValidationError() {
  if (!draft.value.province || !draft.value.city || !draft.value.district) return '请选择完整的地区信息'
  if (!draft.value.address.trim()) return '请输入详细地址'
  if (!draft.value.name.trim()) return '请输入收件人姓名'
  if (draft.value.phone == null) return '请输入联系电话'
}

async function loadAreas() {
  if (Date.now() - areas.value.createAt < 7 * 24 * 60 * 60 * 1000) return

  loadingArea.value = true
  try {
    const response = await fetch('https://oss.suki.club/vtsuru/area_data.json')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    areas.value = { createAt: Date.now(), data: (await response.json()) as AreaData }
  } catch (error) {
    toast.add({ color: 'error', title: `地区数据加载失败：${errorText(error)}` })
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
  const validationError = draftValidationError()
  if (validationError) {
    toast.add({ color: 'warning', title: validationError })
    return
  }
  if (!agreed.value) {
    toast.add({ color: 'warning', title: '请先阅读并同意用户协议' })
    return
  }

  saving.value = true
  try {
    const payload = { ...draft.value, phone: draft.value.phone! }
    const response = await auth.QueryBiliAuthPostAPI<AddressInfo>(`${POINT_API_URL}user/update-address`, payload)
    if (response.code !== 200) throw new Error(response.message)

    const current = auth.biliAuth.address ?? []
    const index = current.findIndex((item) => item.id === response.data.id)
    auth.biliAuth.address = index < 0 ? [...current, response.data] : current.toSpliced(index, 1, response.data)
    editing.value = false
    toast.add({ color: 'success', title: '收货地址已保存' })
  } catch (error) {
    toast.add({ color: 'error', title: `保存失败：${errorText(error)}` })
  } finally {
    saving.value = false
  }
}

async function deleteAddress(address: AddressInfo) {
  if (!address.id) {
    toast.add({ color: 'error', title: '该地址缺少标识，无法删除' })
    return
  }

  saving.value = true
  try {
    const response = await auth.QueryBiliAuthGetAPI(`${POINT_API_URL}user/del-address`, { id: address.id })
    if (response.code !== 200) throw new Error(response.message)
    auth.biliAuth.address = addresses.value.filter((item) => item.id !== address.id)
    toast.add({ color: 'success', title: '收货地址已删除' })
  } catch (error) {
    toast.add({ color: 'error', title: `删除失败：${errorText(error)}` })
  } finally {
    saving.value = false
  }
}

async function confirmDeleteAddress() {
  const address = addressToDelete.value
  if (!address) return

  addressToDelete.value = undefined
  await deleteAddress(address)
}

function reset() {
  editing.value = false
  agreed.value = false
  draft.value = createAddressDraft()
  addressToDelete.value = undefined
}

defineExpose({ reset })
</script>

<template>
  <section class="point-settings__panel">
    <div class="point-settings__panel-header">
      <div class="point-settings__panel-title">
        <span class="point-settings__panel-icon"><UIcon name="i-lucide-map-pin" /></span>
        <div>
          <h2>收货地址</h2>
          <span>{{ addresses.length }} 个地址</span>
        </div>
      </div>
      <UButton
        color="primary"
        variant="soft"
        size="sm"
        icon="i-lucide-plus"
        @click="openEditor()"
      >
        添加地址
      </UButton>
    </div>

    <div
      v-if="saving"
      class="point-settings__loading"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="animate-spin"
      />
    </div>
    <UEmpty
      v-else-if="addresses.length === 0"
      title="还没有收货地址"
      icon="i-lucide-map-pin-off"
      size="sm"
      class="point-settings__empty"
    >
      <template #actions>
        <UButton
          color="primary"
          variant="soft"
          size="sm"
          @click="openEditor()"
        >
          添加第一个地址
        </UButton>
      </template>
    </UEmpty>

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
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-pencil"
            @click="openEditor(address)"
          >
            编辑
          </UButton>
          <UButton
            color="error"
            variant="ghost"
            size="xs"
            icon="i-lucide-trash-2"
            @click="addressToDelete = address"
          >
            删除
          </UButton>
        </div>
      </article>
    </div>
  </section>

  <UModal
    v-model:open="editing"
    :title="draft.id ? '编辑收货地址' : '添加收货地址'"
    :dismissible="!saving"
    :ui="{ content: 'point-settings__address-modal' }"
  >
    <template #body>
      <div
        v-if="loadingArea"
        class="point-settings__loading point-settings__loading--modal"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="animate-spin"
        />
      </div>
      <div
        v-else
        class="point-settings__form"
      >
        <div class="point-settings__area-fields">
          <UFormField
            label="省份"
            required
          >
            <USelectMenu
              v-model="draft.province"
              :items="provinceOptions"
              value-key="value"
              placeholder="选择省份"
              @update:model-value="changeProvince"
            />
          </UFormField>
          <UFormField
            label="城市"
            required
          >
            <USelectMenu
              v-model="draft.city"
              :items="cityOptions"
              value-key="value"
              :disabled="!draft.province"
              placeholder="选择城市"
              @update:model-value="changeCity"
            />
          </UFormField>
          <UFormField
            label="区县"
            required
          >
            <USelectMenu
              v-model="draft.district"
              :items="districtOptions"
              value-key="value"
              :disabled="!draft.city"
              placeholder="选择区县"
              @update:model-value="changeDistrict"
            />
          </UFormField>
          <UFormField label="街道">
            <USelectMenu
              v-model="draft.street"
              :items="streetOptions"
              value-key="value"
              :disabled="!draft.district"
              placeholder="选择街道"
              clear
            />
          </UFormField>
        </div>

        <UFormField
          label="详细地址"
          required
        >
          <UTextarea
            v-model="draft.address"
            :rows="2"
            :maxrows="4"
            autoresize
            placeholder="楼栋、单元和门牌号"
          />
        </UFormField>

        <div class="point-settings__contact-fields">
          <UFormField
            label="收件人"
            required
          >
            <UInput
              v-model="draft.name"
              placeholder="收件人姓名"
            />
          </UFormField>
          <UFormField
            label="联系电话"
            required
          >
            <UInputNumber
              v-model="draft.phone"
              :increment="false"
              :decrement="false"
              placeholder="联系电话"
              class="point-settings__phone"
            />
          </UFormField>
        </div>

        <div class="point-settings__agreement-check">
          <UCheckbox
            v-model="agreed"
            label="我已阅读并同意"
          />
          <UButton
            color="primary"
            variant="link"
            size="sm"
            @click="emit('showAgreement')"
          >
            用户协议
          </UButton>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="point-settings__modal-actions">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="editing = false"
        >
          取消
        </UButton>
        <UButton
          color="primary"
          :loading="saving"
          @click="saveAddress"
        >
          保存地址
        </UButton>
      </div>
    </template>
  </UModal>

  <UModal
    :open="Boolean(addressToDelete)"
    title="删除收货地址"
    @update:open="!$event && (addressToDelete = undefined)"
  >
    <template #body>
      <p>确认删除这个收货地址？</p>
    </template>
    <template #footer>
      <div class="point-settings__modal-actions">
        <UButton
          color="neutral"
          variant="ghost"
          @click="addressToDelete = undefined"
        >
          取消
        </UButton>
        <UButton
          color="error"
          @click="confirmDeleteAddress"
        >
          删除地址
        </UButton>
      </div>
    </template>
  </UModal>
</template>
