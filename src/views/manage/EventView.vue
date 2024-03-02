<script setup lang="ts">
import { isDarkMode } from '@/Utils'
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import EventFetcherStatusCard from '@/components/EventFetcherStatusCard.vue'
import { AVATAR_URL, BASE_API, EVENT_API_URL } from '@/data/constants'
import { Grid28Filled, List16Filled } from '@vicons/fluent'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDatePicker,
  NDivider,
  NEllipsis,
  NGrid,
  NGridItem,
  NH3,
  NIcon,
  NLi,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NSpin,
  NTable,
  NTag,
  NText,
  NTime,
  NUl,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'

enum EventType {
  Guard,
  SC,
}
interface EventModel {
  type: EventType
  name: string
  uid: number
  msg: string
  time: number
  num: number
  price: number
}

const accountInfo = useAccount()
const message = useMessage()

const rangeShortcuts = {
  上个月: () => {
    const cur = new Date()
    const lastMonth = new Date(cur.getFullYear(), cur.getMonth() - 1)
    return [
      new Date(cur.getFullYear(), cur.getMonth() - 1, 1).getTime(),
      new Date(cur.getFullYear(), cur.getMonth(), 1).getTime(),
    ] as const
  },
  本月: () => {
    const cur = new Date()
    return [new Date(cur.getFullYear(), cur.getMonth(), 1).getTime(), cur.getTime()] as const
  },
}
const selectedDate = ref<[number, number]>([rangeShortcuts.本月()[0], rangeShortcuts.本月()[1]])
const selectedType = ref(EventType.Guard)
const events = ref<EventModel[]>(await get())
const isLoading = ref(false)

const selectedEvents = computed(() => {
  return events.value.filter((e) => e.type == selectedType.value)
})
const displayMode = ref<'grid' | 'column'>('grid')
const exportType = ref<'json' | 'xml' | 'csv'>('csv')

async function onDateChange() {
  isLoading.value = true
  const data = await get()
  events.value = data
  isLoading.value = false
}
async function get() {
  try {
    const data = await QueryGetAPI<EventModel[]>(EVENT_API_URL + 'get', {
      start: selectedDate.value[0],
      end: selectedDate.value[1],
    })
    if (data.code == 200) {
      message.success('已获取数据')
      return new List(data.data).OrderByDescending((d) => d.time).ToArray()
    } else {
      message.error('获取数据失败: ' + data.message)
      return []
    }
  } catch (err) {
    message.error('获取数据失败')
    return []
  }
}
function GetSCColor(price: number): string {
  if (price === 0) return `#2a60b2`
  if (price > 0 && price < 30) return `#2a60b2`
  if (price >= 30 && price < 50) return `#2a60b2`
  if (price >= 50 && price < 100) return `#427d9e`
  if (price >= 100 && price < 500) return `#c99801`
  if (price >= 500 && price < 1000) return `#e09443`
  if (price >= 1000 && price < 2000) return `#e54d4d`
  if (price >= 2000) return `#ab1a32`
  return ''
}
function GetGuardColor(price: number | null | undefined): string {
  if (price) {
    if (price < 138) return ''
    if (price >= 138 && price < 1598) return 'rgb(104, 136, 241)'
    if (price >= 1598 && price < 15998) return 'rgb(157, 155, 255)'
    if (price >= 15998) return 'rgb(122, 4, 35)'
  }
  return ''
}
function exportData() {
  let text = ''
  switch (exportType.value) {
    case 'json': {
      text = JSON.stringify(selectedEvents.value)
      break
    }
    case 'csv': {
      text = objectsToCSV(
        selectedEvents.value.map((v) => ({
          type: v.type,
          time: format(v.time, 'yyyy-MM-dd HH:mm:ss'),
          name: v.name,
          uId: v.uid,
          num: v.num,
          price: v.price,
          msg: v.msg,
        })),
      )
      break
    }
  }
  saveAs(
    new Blob([text], { type: 'text/plain;charset=utf-8' }),
    `${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${format(selectedDate.value[0], 'yyyy-MM-dd HH:mm:ss')}_${format(selectedDate.value[1], 'yyyy-MM-dd HH:mm:ss')}}_${
      accountInfo.value?.id
    }_${accountInfo.value?.name}_${selectedType.value}.${exportType.value}`,
  )
}
function objectsToCSV(arr: any[]) {
  const array = [Object.keys(arr[0])].concat(arr)
  return array
    .map((row) => {
      return Object.values(row)
        .map((value) => {
          return typeof value === 'string' ? JSON.stringify(value) : value
        })
        .toString()
    })
    .join('\n')
}
</script>

<template>
  <NSpace vertical>
    <NAlert v-if="!accountInfo?.isBiliVerified" type="warning">
      使用此功能前你需要先<NButton type="info" text @click="$router.push({ name: 'manage-biliVerify' })"
        >认证Bilibili账号</NButton
      >
    </NAlert>
    <NAlert type="error" title="2024.2.26">
      近期逸站对开放平台直播弹幕流进行了极为严格的限制, 目前本站服务器只能连接个位数的直播间, 这使得在不使用
      <NButton tag="a" href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p" target="_blank" type="primary" text>
        VtsuruEventFetcher
      </NButton>
      的情况下获取弹幕数据几乎不可能实现.
      <br />
      在这种情况下如果你还需要记录上舰, SC等事件请跟随链接里的教程部署
      <NButton tag="a" href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p" target="_blank" type="primary" text>
        VtsuruEventFetcher
      </NButton>
    </NAlert>
    <EventFetcherStatusCard />
  </NSpace>
  <NDivider />
  <NCard size="small" style="witdh: 100%">
    <template v-if="accountInfo?.isBiliVerified">
      <NSpace justify="center" align="center">
        <NDatePicker
          v-model:value="selectedDate"
          @update:value="onDateChange"
          type="datetimerange"
          :shortcuts="rangeShortcuts"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
        <NRadioGroup v-model:value="selectedType">
          <NRadioButton :value="EventType.Guard">舰长</NRadioButton>
          <NRadioButton :value="EventType.SC">Superchat</NRadioButton>
        </NRadioGroup>
        <NButton @click="onDateChange" type="primary" :loading="isLoading"> 刷新 </NButton>
      </NSpace>
      <br />
      <NCard title="导出" size="small">
        <NSpace>
          <NRadioGroup v-model:value="exportType" style="margin: 0 auto">
            <NRadioButton value="csv"> CSV </NRadioButton>
            <NRadioButton value="json"> Json </NRadioButton>
          </NRadioGroup>
          <NButton @click="exportData" type="primary"> 导出 </NButton>
        </NSpace>
      </NCard>
      <NDivider> 共 {{ selectedEvents.length }} 条 </NDivider>
      <NSpin :show="isLoading">
        <NRadioGroup v-model:value="displayMode" style="display: flex; justify-content: center" size="small">
          <NRadioButton value="grid">
            <NIcon :component="Grid28Filled" />
          </NRadioButton>
          <NRadioButton value="column">
            <NIcon :component="List16Filled" />
          </NRadioButton>
        </NRadioGroup>
        <br />
        <Transition mode="out-in" name="fade" appear>
          <div v-if="displayMode == 'grid'">
            <NGrid cols="1 500:2 800:3 1000:4" :x-gap="12" :y-gap="8">
              <NGridItem v-for="item in selectedEvents" v-bind:key="item.time">
                <NCard
                  size="small"
                  :style="`height: ${selectedType == EventType.Guard ? '175px' : '220'}px`"
                  embedded
                  hoverable
                >
                  <NSpace align="center" vertical :size="5">
                    <NAvatar
                      round
                      lazy
                      borderd
                      :size="64"
                      :src="AVATAR_URL + item.uid"
                      :img-props="{ referrerpolicy: 'no-referrer' }"
                      style="box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2)"
                    />
                    <NSpace>
                      <NTag size="tiny" v-if="selectedType == EventType.Guard" :bordered="false"> {{ item.msg }} </NTag>
                      <NTag
                        size="tiny"
                        round
                        :color="{
                          color: selectedType == EventType.Guard ? GetGuardColor(item.price) : GetSCColor(item.price),
                          textColor: 'white',
                          borderColor: isDarkMode() ? 'white' : '#00000000',
                        }"
                      >
                        {{ item.price }}
                      </NTag>
                    </NSpace>
                    <NText>
                      {{ item.name }}
                    </NText>
                    <NText depth="3" style="font-size: small"> <NTime :time="item.time" /> </NText>
                    <NEllipsis v-if="selectedType == EventType.SC">
                      {{ item.msg }}
                    </NEllipsis>
                  </NSpace>
                </NCard>
              </NGridItem>
            </NGrid>
          </div>
          <NTable v-else>
            <thead>
              <tr>
                <th>用户名</th>
                <th>UId</th>
                <th>时间</th>
                <th v-if="selectedType == EventType.Guard">类型</th>
                <th>价格</th>
                <th v-if="selectedType == EventType.SC">内容</th>
              </tr>
            </thead>
            <tbody v-for="item in selectedEvents" v-bind:key="item.time">
              <tr>
                <td>{{ item.name }}</td>
                <td>{{ item.uid }}</td>
                <td><NTime :time="item.time" /></td>
                <td v-if="selectedType == EventType.Guard">{{ item.msg }}</td>
                <td>
                  <NTag
                    :color="{
                      color: selectedType == EventType.Guard ? GetGuardColor(item.price) : GetSCColor(item.price),
                      textColor: 'white',
                      borderColor: 'white',
                    }"
                  >
                    {{ item.price }}
                  </NTag>
                </td>
                <td v-if="selectedType == EventType.SC">
                  <NEllipsis style="max-width: 300px">{{ item.msg }}</NEllipsis>
                </td>
              </tr>
            </tbody>
          </NTable>
        </Transition>
      </NSpin>
    </template>
    <template v-else>
      <NCollapse :default-expanded-names="['1']">
        <NCollapseItem title="这是什么?" name="1">
          可以查看曾经收到的Superchat以及上舰记录, 并导出为 CSV 之类的表格
        </NCollapseItem>
        <NCollapseItem title="可以直接用吗">
          遗憾的是并不能, 使用这个功能需要你拥有一个可以7*24小时运行 Docker 容器或者 Node.js 脚本的环境,
          并且可以访问互联网
        </NCollapseItem>
        <NCollapseItem title="有没有什么要求?">
          关于环境的话理论上能够运行 Docker 或者 Node.js 的环境都能可以
          <br /><br />
          此外, 你至少需要以下技能之一:
          <NUl>
            <NLi>了解并能够使用 Docker 容器</NLi>
            <NLi>了解并能够运行 Node.js</NLi>
            <NLi>熟悉互联网冲浪, 能够跟着教程点击鼠标</NLi>
            <NLi>拥有掌握以上技能的 stf 或者朋友</NLi>
          </NUl>
          <NH3>
            <NText strong>
              即使你对相关知识一窍不通也不用担心, 跟着后面的傻瓜教程中的 Koyeb 也可以完成部署.
              理论上这玩意里头的免费套餐就够用了, 当然如果你想要更稳一点上个付费套餐也不影响
            </NText>
          </NH3>
        </NCollapseItem>
      </NCollapse>
      <NDivider style="margin-bottom: 10px" />
      <NSpace justify="center">
        <NButton tag="a" href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p" target="_blank" type="primary">
          部署指南
        </NButton>
      </NSpace>
    </template>
  </NCard>
</template>
