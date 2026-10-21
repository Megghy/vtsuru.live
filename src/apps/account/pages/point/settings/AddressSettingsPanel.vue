<script setup lang="ts">
import { Add24Regular, Delete24Regular, Edit24Regular, Location24Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import type { AddressInfo } from '@/api/api-models'
import {
  postApiPointUserDeleteAddress,
  postApiPointUserUpdateAddress,
} from '@/api/generated/point/point'
import AddressDisplay from '@/shared/components/points/AddressDisplay.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'
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
    toast.error(`地区数据加载失败：${errorText(error)}`)
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

function changeProvince(val: string) {
  draft.value.province = val
  draft.value.city = undefined
  draft.value.district = undefined
  draft.value.street = undefined
}

function changeCity(val: string) {
  draft.value.city = val
  draft.value.district = undefined
  draft.value.street = undefined
}

function changeDistrict(val: string) {
  draft.value.district = val
  draft.value.street = undefined
}

async function saveAddress() {
  if (!draft.value.province || !draft.value.city || !draft.value.district) {
    toast.warning('请选择完整的省市区')
    return
  }
  if (!draft.value.address.trim()) {
    toast.warning('请输入详细地址')
    return
  }
  if (!draft.value.name.trim()) {
    toast.warning('请输入收件人姓名')
    return
  }
  if (!draft.value.phone) {
    toast.warning('请输入有效的联系电话')
    return
  }
  if (!agreed.value) {
    toast.warning('请先阅读并同意用户协议')
    return
  }

  saving.value = true
  try {
    const payload = { ...draft.value, phone: draft.value.phone as number }
    const response = (await postApiPointUserUpdateAddress(payload as any, {
      headers: Object.fromEntries(await auth.getBiliAuthHeaders()),
    })) as unknown as {
      code: number
      message?: string
      data: AddressInfo
    }
    if (response.code !== 200) throw new Error(response.message)

    const current = auth.biliAuth.address ?? []
    const index = current.findIndex((item) => item.id === response.data.id)
    auth.biliAuth.address = index < 0 ? [...current, response.data] : current.toSpliced(index, 1, response.data)
    editing.value = false
    toast.success('收货地址已保存')
  } catch (error) {
    toast.error(`保存失败：${errorText(error)}`)
  } finally {
    saving.value = false
  }
}

async function deleteAddress(address: AddressInfo) {
  if (!address.id) {
    toast.error('该地址缺少标识，无法删除')
    return
  }

  saving.value = true
  try {
    const response = await postApiPointUserDeleteAddress(
      { id: address.id },
      { headers: Object.fromEntries(await auth.getBiliAuthHeaders()) },
    )
    if (response.code !== 200) throw new Error(response.message)
    auth.biliAuth.address = addresses.value.filter((item) => item.id !== address.id)
    toast.success('收货地址已删除')
  } catch (error) {
    toast.error(`删除失败：${errorText(error)}`)
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
  <section class="point-settings__panel rounded-lg border border-border bg-card p-4 space-y-4">
    <div class="point-settings__panel-header flex items-center justify-between pb-3 border-b border-border/60">
      <div class="point-settings__panel-title flex items-center gap-2.5">
        <span class="point-settings__panel-icon size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <component :is="Location24Regular" class="size-4" />
        </span>
        <div>
          <h2 class="text-sm font-semibold text-foreground">收货地址</h2>
          <span class="text-xs text-muted-foreground">{{ addresses.length }} 个地址</span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs flex items-center gap-1"
        @click="openEditor()"
      >
        <component :is="Add24Regular" class="size-3.5" />
        添加地址
      </Button>
    </div>

    <div v-if="saving" class="py-10 flex justify-center">
      <Spin />
    </div>

    <Empty
      v-else-if="addresses.length === 0"
      description="暂无收货地址"
      class="py-8"
    >
      <template #extra>
        <Button
          size="sm"
          class="mt-2 text-xs"
          @click="openEditor()"
        >
          添加第一个地址
        </Button>
      </template>
    </Empty>

    <div
      v-else
      class="point-settings__address-grid grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <article
        v-for="address in addresses"
        :key="address.id"
        class="point-settings__address p-3 rounded-lg border border-border/80 bg-background flex flex-col justify-between gap-2.5"
      >
        <AddressDisplay :address="address" />
        <div class="point-settings__row-actions flex items-center justify-end gap-1 pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            @click="openEditor(address)"
          >
            <component :is="Edit24Regular" class="size-3.5" />
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个收货地址？"
            positive-text="删除"
            negative-text="取消"
            @positive-click="deleteAddress(address)"
          >
            <template #trigger>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 flex items-center gap-1"
              >
                <component :is="Delete24Regular" class="size-3.5" />
                删除
              </Button>
            </template>
            确认删除这个收货地址？
          </Popconfirm>
        </div>
      </article>
    </div>
  </section>

  <Dialog v-model:open="editing">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold">
          {{ draft.id ? '编辑收货地址' : '添加收货地址' }}
        </DialogTitle>
      </DialogHeader>

      <div v-if="loadingArea" class="py-12 flex justify-center">
        <Spin />
      </div>

      <div v-else class="space-y-3.5 py-2 text-xs">
        <div class="grid grid-cols-2 gap-2.5">
          <div class="space-y-1">
            <label class="font-medium text-foreground">省份</label>
            <Select
              :model-value="draft.province"
              @update:model-value="changeProvince"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="选择省份" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in provinceOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground">城市</label>
            <Select
              :model-value="draft.city"
              :disabled="!draft.province"
              @update:model-value="changeCity"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="选择城市" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in cityOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground">区县</label>
            <Select
              :model-value="draft.district"
              :disabled="!draft.city"
              @update:model-value="changeDistrict"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="选择区县" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in districtOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground">街道 (选填)</label>
            <Select
              :model-value="draft.street"
              :disabled="!draft.district"
              @update:model-value="draft.street = $event ? String($event) : undefined"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="选择街道" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in streetOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-1">
          <label class="font-medium text-foreground">详细地址</label>
          <Textarea
            v-model="draft.address"
            rows="2"
            placeholder="楼栋、单元和门牌号"
            class="text-xs resize-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="space-y-1">
            <label class="font-medium text-foreground">收件人</label>
            <Input
              v-model="draft.name"
              placeholder="收件人姓名"
              class="h-8 text-xs"
            />
          </div>
          <div class="space-y-1">
            <label class="font-medium text-foreground">联系电话</label>
            <Input
              :model-value="draft.phone ? String(draft.phone) : ''"
              type="tel"
              placeholder="联系电话"
              class="h-8 text-xs font-mono"
              @update:model-value="draft.phone = Number($event) || null"
            />
          </div>
        </div>

        <label class="flex items-center gap-2 pt-2 cursor-pointer text-xs">
          <Checkbox v-model:checked="agreed" />
          <span>
            我已阅读并同意
            <button
              type="button"
              class="text-primary hover:underline font-medium inline"
              @click.prevent="emit('showAgreement')"
            >
              用户协议
            </button>
          </span>
        </label>
      </div>

      <DialogFooter class="pt-2">
        <Button
          variant="outline"
          size="sm"
          @click="editing = false"
        >
          取消
        </Button>
        <Button
          size="sm"
          :disabled="saving"
          @click="saveAddress"
        >
          保存地址
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
