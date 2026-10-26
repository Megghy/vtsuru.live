<script setup lang="ts">
import { Add24Regular, ArrowSync24Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import type { ShippingAddressInfo } from '@/api/generated/model'
import { postApiPointUserUpdateAddress } from '@/api/generated/point/point'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const selected = defineModel<ShippingAddressInfo | undefined>({ required: true })

const useAuth = useBiliAuth()
const biliAuth = computed(() => useAuth.biliAuth)
const addressList = computed(() => biliAuth.value.address ?? [])

const showModal = ref(false)
const saving = ref(false)
const current = ref<ShippingAddressInfo>({} as ShippingAddressInfo)
const userAgree = ref(false)

interface AreaData {
  [province: string]: { [city: string]: { [district: string]: string[] } }
}

const areas = usePersistedStorage<{ createAt: number; data: AreaData }>('Data.Areas', { createAt: 0, data: {} })

async function getArea() {
  if (areas.value && Date.now() - areas.value.createAt < 1000 * 60 * 60 * 24 * 7) return
  const res = await fetch('https://oss.suki.club/vtsuru/area_data.json')
  if (!res.ok) throw new Error('获取地区数据失败')
  areas.value = { createAt: Date.now(), data: await res.json() }
}

const toOptions = (obj?: object | string[]) => (Array.isArray(obj) ? obj : Object.keys(obj ?? {}))
const provinceOptions = computed(() => toOptions(areas.value?.data))
const cityOptions = computed(() => toOptions(areas.value?.data?.[current.value.province!]))
const districtOptions = computed(() => toOptions(areas.value?.data?.[current.value.province!]?.[current.value.city!]))
const streetOptions = computed(() =>
  toOptions(areas.value?.data?.[current.value.province!]?.[current.value.city!]?.[current.value.district!]),
)

/** 上级变更时清空下级 */
function setArea(level: 'province' | 'city' | 'district', value: string) {
  const order = ['province', 'city', 'district', 'street'] as const
  current.value[level] = value
  for (const key of order.slice(order.indexOf(level) + 1)) current.value[key] = undefined
}

async function openModal() {
  current.value = {} as ShippingAddressInfo
  userAgree.value = false
  showModal.value = true
  await getArea()
}

async function refreshList() {
  if (!useAuth.isAuthed || !biliAuth.value.id) return
  await useAuth.getAuthInfo()
}

function validate() {
  const a = current.value
  if (!a.province || !a.city || !a.district) return '请选择完整的省市区'
  if (!a.address?.trim()) return '请输入详细地址'
  if (!a.name?.trim()) return '请输入联系人姓名'
  if (!a.phone) return '请输入联系电话'
  if (!userAgree.value) return '请确认信息真实有效'
  return ''
}

async function save() {
  const invalid = validate()
  if (invalid) {
    toast.warning(invalid)
    return
  }

  saving.value = true
  try {
    const data = (await postApiPointUserUpdateAddress(current.value as any, {
      headers: Object.fromEntries(await useAuth.getBiliAuthHeaders()),
    })) as unknown as { code: number; message?: string; data: ShippingAddressInfo }
    if (data.code !== 200) {
      toast.error(`保存失败: ${data.message}`)
      return
    }
    toast.success('地址已保存')
    showModal.value = false
    const list = (biliAuth.value.address ??= [])
    const index = list.findIndex((a) => a.id === data.data.id)
    if (index >= 0) list[index] = data.data
    else list.push(data.data)
    selected.value = data.data
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div class="space-y-1.5">
    <span class="font-medium text-foreground text-xs">收货地址 *</span>
    <div class="flex items-center gap-2">
      <Select
        :model-value="selected?.id ? String(selected.id) : ''"
        @update:model-value="selected = addressList.find((a) => String(a.id) === $event)"
      >
        <SelectTrigger class="flex-1">
          <SelectValue placeholder="请选择收货地址" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="addr in addressList"
            :key="addr.id"
            :value="String(addr.id)"
            class="text-xs"
          >
            {{ addr.name }} ({{ addr.phone }}) · {{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.address }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        class="size-8 shrink-0"
        aria-label="新增收货地址"
        @click="openModal"
      >
        <component
          :is="Add24Regular"
          class="size-3.5"
        />
      </Button>
      <Button
        variant="outline"
        size="icon"
        class="size-8 shrink-0"
        aria-label="刷新地址列表"
        @click="refreshList"
      >
        <component
          :is="ArrowSync24Regular"
          class="size-3.5"
        />
      </Button>
    </div>
  </div>

  <Dialog v-model:open="showModal">
    <DialogContent class="sm:max-w-md p-4 space-y-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm font-semibold">新增收货地址</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="field in [
              { key: 'province', label: '省份', options: provinceOptions, disabled: false },
              { key: 'city', label: '城市', options: cityOptions, disabled: !current.province },
              { key: 'district', label: '区县', options: districtOptions, disabled: !current.city },
              { key: 'street', label: '街道 (选填)', options: streetOptions, disabled: !current.district },
            ] as const"
            :key="field.key"
            class="space-y-1"
          >
            <label class="text-muted-foreground text-[11px]">{{ field.label }}</label>
            <Select
              :model-value="current[field.key] || ''"
              :disabled="field.disabled"
              @update:model-value="
                field.key === 'street'
                  ? (current.street = String($event) || undefined)
                  : setArea(field.key, String($event))
              "
            >
              <SelectTrigger>
                <SelectValue :placeholder="field.label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in field.options"
                  :key="opt"
                  :value="opt"
                  class="text-xs"
                >
                  {{ opt }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-muted-foreground text-[11px]">详细地址</label>
          <Textarea
            v-model="current.address"
            rows="2"
            placeholder="楼栋号、单元号、门牌号等"
            class="text-xs resize-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px]">联系电话</label>
            <Input
              :model-value="current.phone ? String(current.phone) : ''"
              type="tel"
              placeholder="手机号"
              class="font-mono"
              @update:model-value="current.phone = Number($event) || undefined"
            />
          </div>
          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px]">联系人</label>
            <Input
              v-model="current.name"
              placeholder="姓名"
            />
          </div>
        </div>

        <label class="flex items-center gap-1.5 cursor-pointer pt-1">
          <Checkbox v-model:checked="userAgree" />
          <span class="text-xs text-foreground">我确认以上收件信息真实有效</span>
        </label>
      </div>

      <DialogFooter class="pt-2 border-t border-border/60">
        <Button
          variant="outline"
          @click="showModal = false"
        >
          取消
        </Button>
        <Button
          :disabled="!userAgree || saving"
          @click="save"
        >
          保存地址
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
