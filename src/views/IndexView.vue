<script setup lang="ts">
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { NCard, NDivider, NGradientText, NSpace, NText, NIcon, NGrid, NGridItem, NButton } from 'naive-ui'
import vtb from '@/svgs/ic_vtuber.svg'
import { AnalyticsSharp, Calendar, Chatbox, MusicalNote } from '@vicons/ionicons5'
import { useWindowSize } from '@vueuse/core'
import { Lottery24Filled, MoreHorizontal24Filled } from '@vicons/fluent'

const { width } = useWindowSize()

const functions = [
  {
    name: '日程表',
    desc: '提供多种样式的日程表 (还没做完',
    icon: Calendar,
  },
  {
    name: '歌单',
    desc: '可以放自己的歌单或者能唱的歌, 支持多种样式 (也还没做完',
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
    name: '数据跟踪',
    desc: '绑定账号后查看粉丝 舰长 观看数 等数据的历史记录',
    icon: AnalyticsSharp,
  },
  {
    name: '还有更多',
    desc: '有其他合理需求或者建议, 或者有想要添加的样式? 向我提出!',
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
            size="3.6rem"
            :gradient="{
              deg: 180,
              from: '#e5e5e5',
              to: '#c2ebeb',
            }"
            style="font-family: Microsoft YaHei, Times New Roman, Times, serif; font-weight: 700"
          >
            VTSURU.LIVE
          </NGradientText>
          <NText style="font-size: 1.5em; font-weight: 500"> 一个给主播提供便利功能的网站 😊 </NText>
          <span></span>
          <NSpace justify="center">
            <NButton type="primary" size="large" @click="$router.push({ name: 'manage-index' })"> 开始使用 </NButton>
          </NSpace>
        </NSpace>
      </NSpace>

      <NDivider style="width: 90vw" />
      <NGrid cols="2 600:3 800:4" x-gap="50" y-gap="50" style="max-width: 80vw">
        <NGridItem v-for="item in functions" :key="item.name">
          <NSpace align="end">
            <NIcon :component="item.icon" :color="iconColor" size="20" />
            <NText class="index-feature header"> {{ item.name }} </NText>
          </NSpace>
          <NText class="index-feature content"> {{ item.desc }} </NText>
        </NGridItem>
      </NGrid>
    </NSpace>
    <NSpace style="position: absolute; bottom: 0;margin: 0 auto;width: 100vw;" justify="center">
      <span style="color: white">
        BY
        <NButton tag="a" href="https://space.bilibili.com/10021741" target="_blank" text style="color: rgb(161, 236, 199)"> Megghy </NButton>
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

.index-background .header
  font-size: 1.3rem;
  font-weight: 700;
  font-color: #b1b1b1;
.index-background .content
  max-width: 300px;
  font-size: 17px;
  font-color: #b1b1b1;
</style>
