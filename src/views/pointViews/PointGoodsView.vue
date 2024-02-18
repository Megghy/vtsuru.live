<script setup lang="ts">
import { NavigateToNewTab } from '@/Utils'
import { useAccount } from '@/api/account'
import {
  AddressInfo,
  GoodsTypes,
  PointGoodsModel,
  ResponsePointGoodModel,
  ResponsePointOrder2UserModel,
  UserInfo,
} from '@/api/api-models'
import { useUser } from '@/api/user'
import AddressDisplay from '@/components/manage/AddressDisplay.vue'
import PointGoodsItem from '@/components/manage/PointGoodsItem.vue'
import { POINT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NLayoutContent,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NText,
  NTimeline,
  NTimelineItem,
  NTooltip,
  SelectOption,
  useDialog,
  useMessage,
} from 'naive-ui'
import { ref, computed, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  userInfo: UserInfo
  biliInfo: any
}>()
const router = useRouter()

const useAuth = useAuthStore()
const accountInfo = useAccount()
const isLoading = ref(false)
const message = useMessage()
const dialog = useDialog()
const biliAuth = computed(() => useAuth.biliAuth)

const goods = ref<ResponsePointGoodModel[]>([])
const currentPoint = ref<number>(-1)

const showBuyModal = ref(false)
const showAddressSelect = ref(false)

const currentGoods = ref<ResponsePointGoodModel>()
const buyCount = ref(1)
const selectedAddress = ref<AddressInfo>()
const canDoBuy = computed(() => {
  return currentGoods.value && currentGoods.value.price * buyCount.value < currentPoint.value
})

const addressOptions = computed(() => {
  if (!biliAuth.value.id) return []
  return (
    biliAuth.value.address?.map((item) => {
      return {
        label: item.address,
        value: item.id,
      }
    }) ?? []
  )
})

const canBuy = computed(() => {
  if (!biliAuth.value.id) return false
  if (!currentPoint.value) return false
  return true
})
function getTooltip(goods: ResponsePointGoodModel) {
  if (!canBuy.value) return '请先进行账号认证'
  if ((currentPoint.value ?? 0) < goods.price) {
    return '当前积分不足'
  } else {
    return '开始兑换'
  }
}
async function buyGoods() {
  if (buyCount.value < 1) {
    message.error('兑换数量不能小于1')
  } else if (
    !selectedAddress.value &&
    currentGoods.value?.type == GoodsTypes.Physical &&
    !currentGoods.value.collectUrl
  ) {
    message.error('请选择收货地址')
  } else if (!Number.isInteger(buyCount.value)) {
    message.error('兑换数量必须为整数')
  } else {
    try {
      isLoading.value = true
      const data = await useAuth.QueryBiliAuthPostAPI<ResponsePointOrder2UserModel>(POINT_API_URL + 'buy', {
        vId: props.userInfo.id,
        goodsId: currentGoods.value?.id,
        count: buyCount.value,
        addressId: selectedAddress.value ? selectedAddress.value.id : null,
      })
      if (data.code == 200) {
        message.info('兑换成功')
        dialog.success({
          title: '成功',
          content: `兑换成功，订单号：${data.data.id}`,
          positiveText: '前往查看',
          negativeText: '我知道了',
          onPositiveClick: () => {
            router.push({ name: 'bili-user', hash: '#orders' })
          },
          onNegativeClick: () => {
            showBuyModal.value = false
            showAddressSelect.value = false
            selectedAddress.value = undefined
            buyCount.value = 1
            currentGoods.value = undefined
          },
        })
      } else {
        message.error('兑换失败: ' + data.message)
        console.error(data)
      }
    } catch (err) {
      console.error(err)
      message.error('兑换失败: ' + err)
    } finally {
      isLoading.value = false
    }
  }
}
function onBuyClick(good: ResponsePointGoodModel) {
  showBuyModal.value = true
  currentGoods.value = good
}
const renderLabel = (option: SelectOption) => {
  return h(AddressDisplay, { address: biliAuth.value.address?.find((a) => a.id == option.value), size: 'small' })
}
const renderOption = ({ node, option }: { node: any; option: SelectOption }) => {
  return h(
    NButton,
    {
      style: 'width: 100%;height: 100%;margin: 5px;padding: 12px;',
      secondary: true,
      type: selectedAddress.value?.id != option.value ? 'default' : 'info',
      onClick: () => {
        selectedAddress.value = biliAuth.value.address?.find((a) => a.id == option.value)
        showAddressSelect.value = false
      },
    },
    () => h(AddressDisplay, { address: biliAuth.value.address?.find((a) => a.id == option.value) }),
  )
}
function gotoAuthPage() {
  if (!accountInfo.value?.biliUserAuthInfo) {
    message.error('你尚未进行 Bilibili 认证, 请前往面板进行认证和绑定')
    return
  }
  useAuthStore()
    .setCurrentAuth(accountInfo.value?.biliUserAuthInfo.token)
    .then(() => {
      NavigateToNewTab('/bili-user')
    })
}

onMounted(async () => {
  if (props.userInfo && useAuth.isAuthed) {
    if (!biliAuth.value.id) {
      isLoading.value = true
      await useAuth.getAuthInfo()
    }
    if (biliAuth.value.id) {
      currentPoint.value = (await useAuth.GetSpecificPoint(props.userInfo.id)) ?? -1
    }
  }

  goods.value = await useAuth.GetGoods(props.userInfo.id, message)
  isLoading.value = false
})
</script>

<template>
  <NAlert v-if="!useAuth.isAuthed" type="warning">
    你尚未进行 Bilibili 账号认证, 无法兑换积分
    <br />
    <NButton type="primary" @click="$router.push({ name: 'bili-auth' })" size="small" style="margin-top: 12px">
      立即认证
    </NButton>
  </NAlert>
  <NCard v-else style="max-width: 600px" embedded hoverable>
    <template #header> 你好, {{ useAuth.biliAuth.name }} </template>
    <template #header-extra>
      <NButton type="info" @click="gotoAuthPage" secondary size="small"> 前往认证用户中心 </NButton>
    </template>
    <NText> 你在 {{ userInfo.extra?.streamerInfo?.name ?? userInfo.name }} 的直播间的积分为 {{ currentPoint }} </NText>
  </NCard>
  <NDivider />
  <NSpin :show="isLoading">
    <NEmpty v-if="goods.length == 0"> 暂无礼物 </NEmpty>
    <NGrid v-else cols="1 500:2 700:3 1000:4 1200:5" x-gap="12" y-gap="8">
      <NGridItem v-for="item in goods" :key="item.id">
        <PointGoodsItem :goods="item">
          <template #footer>
            <NFlex justify="space-between" align="center">
              <NTooltip>
                <template #trigger>
                  <NButton :disabled="!canBuy" size="small" type="primary" @click="onBuyClick(item)">兑换</NButton>
                </template>
                {{ getTooltip(item) }}
              </NTooltip>
              <NFlex style="flex: 1" justify="end">
                <NText style="size: 34px">
                  🪙
                  {{ item.price }}
                </NText>
              </NFlex>
            </NFlex>
          </template>
        </PointGoodsItem>
      </NGridItem>
    </NGrid>
  </NSpin>
  <NModal
    v-model:show="showBuyModal"
    v-if="currentGoods"
    preset="card"
    title="确认兑换"
    style="width: 400px; max-width: 90vw; height: auto"
  >
    <template #header>
      <NFlex align="baseline">
        <NTag :type="currentGoods.type == GoodsTypes.Physical ? 'info' : 'default'" :bordered="false">
          {{ currentGoods.type == GoodsTypes.Physical ? '实体礼物' : '虚拟物品' }}
        </NTag>
        <NText> {{ currentGoods.name }} </NText>
      </NFlex>
    </template>
    <PointGoodsItem v-if="currentGoods" :goods="currentGoods" />
    <template v-if="currentGoods.type == GoodsTypes.Physical">
      <NDivider> 选项 </NDivider>
      <NForm>
        <NFormItem label="兑换数量" required
          ><NInputNumber
            v-model:value="buyCount"
            :min="1"
            :max="currentGoods.maxBuyCount ?? 100000"
            style="max-width: 120px"
            step="1"
            :precision="0"
          />
        </NFormItem>
        <NFormItem
          v-if="
            currentGoods.type == GoodsTypes.Physical &&
            (currentGoods.collectUrl == null || currentGoods.collectUrl == undefined)
          "
          label="收货地址"
          required
        >
          <NSelect
            v-model:show="showAddressSelect"
            :value="selectedAddress?.id"
            :options="addressOptions"
            :render-label="renderLabel"
            :render-option="renderOption"
            placeholder="请选择地址"
          />
          &nbsp;
          <NButton size="small" type="info" tag="a" href="/bili-user#settings" target="_blank"> 管理收货地址 </NButton>
        </NFormItem>
      </NForm>
    </template>
    <NDivider>
      <NTag :type="currentGoods.price * buyCount > currentPoint ? 'error' : 'success'">
        {{ currentGoods.price * buyCount > currentPoint ? '积分不足' : '可兑换' }}
      </NTag>
    </NDivider>
    <NButton type="primary" :disabled="!canDoBuy" @click="buyGoods" :loading="isLoading"> 确认兑换 </NButton>
    <NText>
      所需积分: {{ currentGoods.price * buyCount }}
      <NDivider vertical />
      当前积分: {{ currentPoint }}
    </NText>
  </NModal>
</template>
