<script setup lang="ts">
import { QueryGetAPI } from '@/api/query'
import { VTSURU_API_URL } from '@/data/constants'
import {
  BookCoins20Filled,
  Info24Filled,
  Lottery24Filled,
  MoreHorizontal24Filled,
  TabletSpeaker24Filled,
  VehicleShip24Filled,
  VideoAdd20Filled,
  Chat24Filled,
  PersonFeedback24Filled
} from '@vicons/fluent'
import { AnalyticsSharp, Calendar, Chatbox, ListCircle, MusicalNote } from '@vicons/ionicons5'
import { useWindowSize } from '@vueuse/core'
import { NButton, NDivider, NEllipsis, NFlex, NGradientText, NGrid, NGridItem, NIcon, NNumberAnimation, NSpace, NText, NTooltip, NAlert, NCard, NStatistic, NTag, NBadge } from 'naive-ui'
import { onMounted, ref } from 'vue'
import vtb from '@/svgs/ic_vtuber.svg'

const { width } = useWindowSize()

const functions = [
  {
    name: '直播事件记录',
    desc: '能够记录并查询上舰和SC记录',
    icon: VehicleShip24Filled,
  },
  {
    name: '积分兑换',
    desc: '通过上舰, Superchat, 赠送礼物等操作可以获取积分, 并通过积分兑换虚拟或者实体礼物',
    icon: BookCoins20Filled,
  },
  {
    name: '弹幕机 (OBS',
    desc: '在OBS上显示直播间弹幕、礼物和互动内容，兼容blivechat样式 (开发中',
    icon: Chat24Filled,
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
    name: '弹幕点歌 (歌势)',
    desc: '可以让弹幕进行点歌, 然后自己唱',
    icon: ListCircle,
  },
  {
    name: '弹幕点歌 (点播)',
    desc: '可以让弹幕进行点歌, 进行搜索后直接播放',
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
    desc: '创建用来收集视频链接的页面, 可以从动态爬取(画饼), 也可以提前对视频进行筛选',
    icon: VideoAdd20Filled,
  },
  {
    name: '直播场次记录',
    desc: '记录每场直播的数据以及弹幕等内容',
    icon: VehicleShip24Filled,
  },
  {
    name: '数据跟踪',
    desc: '绑定账号后查看粉丝 舰长 观看数 等数据的历史记录',
    icon: AnalyticsSharp,
  },
  {
    name: '还有更多',
    desc: '更多功能仍在开发中. 有其他合理需求或者建议, 或者有想要添加的样式? 向我提出!',
    icon: MoreHorizontal24Filled,
  },
]
type IndexDataType = {
  userCount: number
  streamers: { name: string, uname: string, avatar: string, uid: number, roomId: number }[]
}

const iconColor = 'white'
const indexData = ref<IndexDataType>()

onMounted(async () => {
  const data = await QueryGetAPI<IndexDataType>(VTSURU_API_URL + 'get-index-data')
  if (data.code == 200) {
    indexData.value = data.data
  }
})
</script>

<template>
  <div class="index-background">
    <NSpace
      vertical
      justify="center"
      align="center"
      style="padding-top: 30px; padding-bottom: 30px;"
    >
      <!-- 顶部标题部分 -->
      <NCard style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: none; width: 90vw; max-width: 1400px; ">
        <NSpace
          justify="center"
          align="center"
          :size="width > 700 ? 50 : 0"
        >
          <vtb />
          <NSpace
            vertical
            justify="center"
          >
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
            <NText style="font-size: 1.5em; font-weight: 500; color: white">
              一个给主播提供便利功能的网站 😊
            </NText>
            <span />
            <!-- 主播 / 观众入口 -->
            <NSpace
              justify="center"
              align="center"
            >
              <NFlex
                :wrap="false"
                justify="center"
                align="center"
                style="gap: 24px; margin-top: 10px;"
              >
                <!-- 主播入口 -->
                <NTooltip placement="bottom">
                  <template #trigger>
                    <NCard
                      hoverable
                      style="width: 240px; background: rgba(255, 255, 255, 0.15); cursor: pointer; border: none;"
                      @click="$router.push({ name: 'manage-index' })"
                    >
                      <NFlex
                        vertical
                        align="center"
                        justify="center"
                        :size="8"
                      >
                        <NIcon
                          :component="PersonFeedback24Filled"
                          size="36"
                          color="white"
                        />
                        <NText style="font-size: 1.2rem; font-weight: 500; color: white;">
                          我是主播
                        </NText>
                        <NButton
                          type="primary"
                          secondary
                          size="small"
                        >
                          开始使用
                        </NButton>
                      </NFlex>
                    </NCard>
                  </template>
                  进入主播后台，管理直播相关工具与设置
                </NTooltip>

                <!-- 观众入口 -->
                <NTooltip placement="bottom">
                  <template #trigger>
                    <NCard
                      hoverable
                      style="width: 240px; background: rgba(255, 255, 255, 0.15); cursor: pointer; border: none;"
                      @click="$router.push({ name: 'bili-user' })"
                    >
                      <NFlex
                        vertical
                        align="center"
                        justify="center"
                        :size="8"
                      >
                        <NIcon
                          :component="Chat24Filled"
                          size="36"
                          color="white"
                        />
                        <NText style="font-size: 1.2rem; font-weight: 500; color: white;">
                          我是观众
                        </NText>
                        <NButton
                          type="info"
                          secondary
                          size="small"
                        >
                          用户主页
                        </NButton>
                      </NFlex>
                    </NCard>
                  </template>
                  进入个人主页，查看积分与互动记录
                </NTooltip>
              </NFlex>
            </NSpace>

            <!-- 其他操作按钮 -->
            <NSpace
              justify="center"
              align="center"
              style="margin-top: 20px;"
            >
              <NButton
                size="large"
                @click="$router.push('/@Megghy')"
              >
                展示
              </NButton>
              <NButton
                size="large"
                tag="a"
                href="https://play-live.bilibili.com/details/1698742711771"
                target="_blank"
                color="#ff778f"
              >
                幻星平台
              </NButton>
              <NButton
                type="info"
                size="large"
                @click="$router.push({ name: 'about' })"
              >
                关于
              </NButton>
            </NSpace>
          </NSpace>
        </NSpace>
      </NCard>

      <!-- 用户统计部分 -->
      <NCard
        style="background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px);
        border: none; width: 90vw; max-width: 1400px;"
        size="small"
      >
        <NFlex
          justify="center"
          align="center"
        >
          <NText style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">
            本站用户: <NNumberAnimation
              :from="0"
              :to="indexData?.userCount"
              show-separator
            />
          </NText>
        </NFlex>
      </NCard>

      <!-- 功能列表部分 -->
      <NCard style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: none; width: 90vw; max-width: 1400px; margin-bottom: 20px;">
        <NFlex vertical>
          <NFlex
            justify="center"
            align="center"
            style="margin-bottom: 20px;"
          >
            <NText style="font-size: 1.2rem; font-weight: 500; background-image: linear-gradient(to right, #e5e5e5, #c2ebeb); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              网站功能
            </NText>
          </NFlex>

          <NFlex
            :wrap="true"
            justify="center"
            style="gap: 15px;"
          >
            <NCard
              v-for="item in functions"
              :key="item.name"
              style="width: 300px; max-width: 100%; background: rgba(255, 255, 255, 0.2); border: none; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);"
              hoverable
            >
              <NFlex vertical>
                <NFlex
                  align="center"
                  style="margin-bottom: 10px;"
                >
                  <NIcon
                    :component="item.icon"
                    size="24"
                    color="white"
                  />
                  <NText style="font-size: 1.1rem; font-weight: 500; margin-left: 10px; color: white;">
                    {{ item.name }}
                  </NText>
                </NFlex>
                <NText style="line-height: 1.6; color: rgba(255, 255, 255, 0.9);">
                  {{ item.desc }}
                </NText>
              </NFlex>
            </NCard>
          </NFlex>
        </NFlex>
      </NCard>

      <!-- 客户端专属功能部分 -->
      <NCard style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: none; width: 90vw; max-width: 1400px; margin-bottom: 20px;">
        <NFlex vertical>
          <NFlex
            justify="center"
            align="center"
            style="margin-bottom: 20px;"
          >
            <NText style="font-size: 1.2rem; font-weight: 500; background-image: linear-gradient(to right, #e5e5e5, #c2ebeb); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              客户端功能
            </NText>
          </NFlex>

          <NFlex
            :wrap="true"
            justify="center"
            style="gap: 20px;"
          >
            <NCard
              style="width: 380px; max-width: 100%; background: rgba(255, 255, 255, 0.2); border: none; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);"
              hoverable
            >
              <NFlex vertical>
                <NFlex
                  align="center"
                  style="margin-bottom: 10px;"
                >
                  <NIcon
                    :component="PersonFeedback24Filled"
                    size="24"
                    color="white"
                  />
                  <NText style="font-size: 1.1rem; font-weight: 500; margin-left: 10px; color: white;">
                    自动操作
                  </NText>
                </NFlex>
                <NText style="line-height: 1.6; color: rgba(255, 255, 255, 0.9);">
                  支持弹幕自动回复、礼物感谢、上舰私信、关注感谢、入场欢迎、定时发送和SC感谢等功能，使用模板系统和JS执行环境，可定制化程度挺高
                </NText>
              </NFlex>
            </NCard>

            <NCard
              style="width: 380px; max-width: 100%; background: rgba(255, 255, 255, 0.2); border: none; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);"
              hoverable
            >
              <NFlex vertical>
                <NFlex
                  align="center"
                  style="margin-bottom: 10px;"
                >
                  <NIcon
                    :component="Chat24Filled"
                    size="24"
                    color="white"
                  />
                  <NText style="font-size: 1.1rem; font-weight: 500; margin-left: 10px; color: white;">
                    弹幕机 (客户端)
                  </NText>
                </NFlex>
                <NText style="line-height: 1.6; color: rgba(255, 255, 255, 0.9);">
                  在自己电脑上显示直播间弹幕、礼物和互动内容
                </NText>
              </NFlex>
            </NCard>
          </NFlex>

          <NFlex
            justify="center"
            style="margin-top: 20px;"
          >
            <NSpace>
              <NButton
                type="primary"
                tag="a"
                href="https://www.wolai.com/carN6qvUm3FErze9Xo53ii"
                target="_blank"
              >
                <template #icon>
                  <NIcon :component="Info24Filled" />
                </template>
                客户端安装说明
              </NButton>
              <NButton
                ghost
                tag="a"
                href="https://github.com/Megghy/vtsuru-fetvher-client"
                target="_blank"
                color="white"
              >
                客户端代码
              </NButton>
              <NButton
                ghost
                tag="a"
                href="https://github.com/Megghy/vtsuru.live/tree/master/src/client"
                target="_blank"
                color="white"
              >
                逻辑代码
              </NButton>
            </NSpace>
          </NFlex>
        </NFlex>
      </NCard>

      <!-- 使用本站的主播部分 -->
      <NCard style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: none; width: 90vw; max-width: 1400px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
        <NFlex vertical>
          <NFlex
            justify="center"
            align="center"
            style="margin-bottom: 20px;"
          >
            <NText style="font-size: 1.2rem; font-weight: 500; background-image: linear-gradient(to right, #e5e5e5, #c2ebeb); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              正在使用本站的主播们
              <NTooltip>
                <template #trigger>
                  <NIcon :component="Info24Filled" />
                </template>
                随机展示不分先后, 仅粉丝数大于500的主播
              </NTooltip>
            </NText>
          </NFlex>

          <NFlex
            v-if="indexData"
            vertical
            style="max-width: 90vw;"
          >
            <NFlex
              align="center"
              justify="center"
              :size="32"
              :wrap="true"
              style="gap: 10px;"
            >
              <NFlex
                v-for="streamer in indexData?.streamers"
                :key="streamer.name"
                style="display: flex;"
                align="center"
                justify="center"
              >
                <div>
                  <img
                    :src="streamer.avatar + '@64w'"
                    referrerpolicy="no-referrer"
                    height="32"
                    style="border-radius: 50%;"
                  >
                </div>
                <NButton
                  tag="a"
                  :href="'@' + streamer.name"
                  text
                >
                  {{ streamer.uname || streamer.name }}
                </NButton>
              </NFlex>
            </NFlex>
            <NText style="text-align: center; margin-top: 10px; color: white;">
              还有更多...
            </NText>
            <NText
              depth="3"
              style="text-align: center; margin-top: 5px;"
            >
              如果你不想要被展示在主页, 请前往
              <NButton
                text
                @click="$router.push({ name: 'manage-index', query: { tab: 'setting', setting: 'index' } })"
              >
                这里
              </NButton>
              进行设置
            </NText>
          </NFlex>
        </NFlex>
      </NCard>
    </NSpace>
    <NSpace
      style="position: absolute; bottom: 0; margin: 0 auto; width: 100vw"
      justify="center"
    >
      <span style="color: white">
        BY
        <NButton
          tag="a"
          href="https://space.bilibili.com/10021741"
          target="_blank"
          text
          style="color: rgb(215, 245, 230)"
        >
          Megghy
        </NButton>
      </span>
    </NSpace>
  </div>
</template>

<style lang="stylus" scoped>
.index-background
    position: relative;
    /* 保证全屏高度，避免底部留白 */
    min-height: 100vh;
    background: #8360c3;  /* fallback for old browsers */
    background: -webkit-linear-gradient(to right, #2ebf91, #8360c3);  /* Chrome 10-25, Safari 5.1-6 */
    background: linear-gradient(to right, #2ebf91, #8360c3); /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */
    overflow: auto
    padding-bottom: 50px;
</style>
