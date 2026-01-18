<script setup lang="ts">
import type { ForumModel, ForumTopicBaseModel } from '@/api/models/forum'
import { ArrowReply24Filled, Chat24Regular, Delete24Filled, MoreVertical24Filled, Star24Filled } from '@vicons/fluent'
import { SyncCircleSharp } from '@vicons/ionicons5'
import { NButton, NDropdown, NFlex, NIcon, NTag, NText, NTime, NTooltip, useDialog, useThemeVars } from 'naive-ui';
import { h } from 'vue'
import { useAccount } from '@/api/account'
import { useForumStore } from '@/store/useForumStore'

const props = defineProps<{
  item: ForumTopicBaseModel
  forum: ForumModel
}>()

const useForum = useForumStore()
const dialog = useDialog()
const accountInfo = useAccount()
const themeVars = useThemeVars()

function onDropdownSelect(key: string) {
  switch (key) {
    case 'delete':
      dialog.warning({
        title: '警告',
        content: '确定要删除这条话题吗？',
        positiveText: '确定',
        negativeText: '再想想',
        onPositiveClick: () => {
          useForum.DelTopic(props.item.id).then((success) => {
            if (success) {
              setTimeout(() => {
                window.location.reload()
              }, 1000)
            }
          })
        },
      })
      break
    case 'restore':
      dialog.warning({
        title: '问问',
        content: '确定要恢复这条话题吗？',
        positiveText: '确定',
        negativeText: '再想想',
        onPositiveClick: () => {
          useForum.RestoreTopic(props.item.id).then((success) => {
            if (success) {
              props.item.isDeleted = false
            }
          })
        },
      })
      break
    case 'top':
      dialog.info({
        title: '问',
        content: `确定要${props.item.isPinned ? '取消' : ''}置顶这条话题吗？`,
        positiveText: '确定',
        negativeText: '再想想',
        onPositiveClick: () => {
          useForum.SetTopicTop(props.item.id, !props.item.isPinned).then((success) => {
            if (success) {
              props.item.isPinned = !props.item.isPinned
            }
          })
        },
      })

      break
  }
}
</script>

<template>
  <NFlex align="center">
    <NFlex
      align="center"
      :wrap="false"
    >
      <NTag
        v-if="item.isDeleted"
        size="small"
        round
        :bordered="false"
      >
        已删除
      </NTag>
      <NTag
        v-if="item.isPinned"
        size="small"
        round
        :bordered="false"
      >
        <NIcon
          :component="Star24Filled"
          :color="themeVars.warningColor"
        />
      </NTag>
      <NTag
        size="small"
      >
        <template #icon>
          <NIcon :component="Chat24Regular" />
        </template>
        {{ item.commentCount }}
      </NTag>
      <NText
        :style="{ fontSize: 'large', color: item.user?.id === accountInfo?.id ? themeVars.successColor : undefined }"
        :depth="item.isDeleted ? 3 : 1"
      >
        {{ item.title }}
      </NText>
    </NFlex>
    <NFlex
      :style="{ flex: 1, color: themeVars.textColor3, fontSize: 'small' }"
      justify="end"
      align="center"
    >
      <template v-if="item.latestRepliedBy">
        <span>
          <NIcon
            :component="ArrowReply24Filled"
            size="15"
          />
          @{{ item.latestRepliedBy.name }}
        </span>
      </template>
      <template v-else>
        @{{ item.user?.name }} 发布于
      </template>
      <NTooltip>
        <template #trigger>
          <NTime
            :time="item.createAt"
            type="relative"
          />
        </template>
        <NTime :time="item.createAt" />
      </NTooltip>
      <NDropdown
        v-if="forum.isAdmin"
        :options="[
          {
            label: item.isPinned ? '取消置顶' : '置顶',
            key: 'top',
            icon: () => h(NIcon, { component: Star24Filled }),
            type: 'info',
          },
          {
            label: item.isDeleted ? '恢复' : '删除',
            key: item.isDeleted ? 'restore' : 'delete',
            icon: () => h(NIcon, { component: item.isDeleted ? SyncCircleSharp : Delete24Filled }),
            type: 'error',
          },
        ]"
        trigger="hover"
        @select="onDropdownSelect"
      >
        <NButton text>
          <template #icon>
            <NIcon :component="MoreVertical24Filled" />
          </template>
        </NButton>
      </NDropdown>
    </NFlex>
  </NFlex>
</template>
