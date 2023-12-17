<script setup lang="ts">
import { NCard, NDivider, NGradientText, NSpace, NText, NIcon, NGrid, NGridItem, NButton } from 'naive-ui'
import vtb from '@/svgs/ic_vtuber.svg'
import { AnalyticsSharp, Calendar, Chatbox, ListCircle, MusicalNote } from '@vicons/ionicons5'
import { useWindowSize } from '@vueuse/core'
import { Lottery24Filled, MoneyOff24Filled, MoreHorizontal24Filled, TabletSpeaker24Filled, VehicleShip24Filled, VideoAdd20Filled } from '@vicons/fluent'

const { width } = useWindowSize()

const functions = [
  {
    name: '直播事件记录',
    desc: '能够记录并查询上舰和SC记录',
    icon: VehicleShip24Filled,
  },
  {
    name: '直播场次记录',
    desc: '记录每场直播的数据以及弹幕等内容',
    icon: VehicleShip24Filled,
  },
  {
    name: '日程表',
    desc: '提供多种样式的日程表',
    icon: Calendar,
  },
  {
    name: '歌单',
    desc: '可以放自己的歌单或者能唱的歌, 支持多种样式',
    icon: MusicalNote,
  },
  {
    name: '棉花糖 (提问箱',
    desc: '一个简单易用的提问箱',
    icon: Chatbox,
  },
  {
    name: '动态抽奖',
    desc: '从动态评论区抽取评论或者转发的用户',
    icon: Lottery24Filled,
  },
  {
    name: '直播抽奖',
    desc: '从直播间弹幕或礼物抽取用户',
    icon: Lottery24Filled,
  },
  {
    name: '弹幕点歌',
    desc: '可以让弹幕进行点歌!',
    icon: ListCircle,
  },
  {
    name: '弹幕排队',
    desc: '通过发送弹幕和礼物加入队列, 允许设置多种条件',
    icon: ListCircle,
  },
  {
    name: '读弹幕',
    desc: '通过浏览器自带的tts服务念出弹幕 (此功能需要 Chrome, Edge 等现代浏览器!)',
    icon: TabletSpeaker24Filled,
  },
  {
    name: '视频征集',
    desc: '创建用来收集视频链接的页面, 可以从动态爬取, 也可以提前对视频进行筛选',
    icon: VideoAdd20Filled,
  },
  {
    name: '数据跟踪',
    desc: '绑定账号后查看粉丝 舰长 观看数 等数据的历史记录',
    icon: AnalyticsSharp,
  },
  {
    name: '绝不收米!',
    desc: '为爱发电, 所有功能都免费并提供技术支持 (当然你想赞助的话也可以捏',
    icon: MoneyOff24Filled,
  },
  {
    name: '还有更多',
    desc: '更多功能仍在开发中. 有其他合理需求或者建议, 或者有想要添加的样式? 向我提出!',
    icon: MoreHorizontal24Filled,
  },
]

const iconColor = 'white'
</script>

<template>
  <div class="index-background">
    <NSpace vertical justify="center" align="center" style="padding-top: 30px">
      <NSpace justify="center" align="center" :size="width > 700 ? 50 : 0">
        <vtb />
        <NSpace vertical justify="center">
          <NGradientText
            size="3rem"
            :gradient="{
              deg: 180,
              from: '#e5e5e5',
              to: '#c2ebeb',
            }"
            style="font-weight: 700"
          >
            VTSURU.LIVE
          </NGradientText>
          <NText style="font-size: 1.5em; font-weight: 500; color: white"> 一个给主播提供便利功能的网站 😊 </NText>
          <span></span>
          <NSpace justify="center">
            <NButton type="primary" size="large" @click="$router.push({ name: 'manage-index' })"> 开始使用 </NButton>
            <NButton size="large" @click="$router.push('/user/Megghy')"> 展示 </NButton>
            <NButton size="large" tag="a" href="https://play-live.bilibili.com/details/1698742711771" target="_blank" color="#ff778f"> 幻星平台 </NButton>
            <NButton type="info" size="large" @click="$router.push({ name: 'about' })"> 关于 </NButton>
          </NSpace>
        </NSpace>
      </NSpace>

      <NDivider style="width: 90vw" />
      <NGrid cols="1 s:2 m:3 l:4 xl:5 2xl:5" x-gap="50" y-gap="50" style="max-width: 80vw" responsive="screen">
        <NGridItem v-for="item in functions" :key="item.name">
          <NSpace align="end">
            <NIcon :component="item.icon" :color="iconColor" size="20" />
            <NText class="index-feature header"> {{ item.name }} </NText>
          </NSpace>
          <NText class="index-feature content"> {{ item.desc }} </NText>
        </NGridItem>
      </NGrid>
    </NSpace>
    <NSpace style="position: absolute; bottom: 0; margin: 0 auto; width: 100vw" justify="center">
      <span style="color: white">
        BY
        <NButton tag="a" href="https://space.bilibili.com/10021741" target="_blank" text style="color: rgb(215, 245, 230)"> Megghy </NButton>
      </span>
    </NSpace>
  </div>
</template>

<style lang="stylus" scoped>
body
    margin:0
.index-background
    display: abslute;
    height: 100vh;
    background: #8360c3;  /* fallback for old browsers */
    background: -webkit-linear-gradient(to right, #2ebf91, #8360c3);  /* Chrome 10-25, Safari 5.1-6 */
    background: linear-gradient(to right, #2ebf91, #8360c3); /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */
    overflow: auto

.index-background .header
  font-size: 1.3rem;
  font-weight: 700;
  color: white;
.index-background .content
  max-width: 300px;
  font-size: 17px;
  color: white;
</style>
