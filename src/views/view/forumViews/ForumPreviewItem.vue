<script setup lang="ts">
import { ForumModel, ForumTopicBaseModel } from '@/api/models/forum'
import { useForumStore } from '@/store/useForumStore'
import { ArrowReply24Filled, Chat24Regular, MoreVertical24Filled, Star24Filled } from '@vicons/fluent'
import { NButton, NDropdown, NFlex, NIcon, NTag, NText, NTime, NTooltip, useDialog } from 'naive-ui'

const props = defineProps<{
  item: ForumTopicBaseModel
  forum: ForumModel
}>()

const useForum = useForumStore()
const dialog = useDialog()

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
    <NFlex align="center" :wrap="false">
      <NTag v-if="item.isPinned" size="small" round>
        <NIcon :component="Star24Filled" color="#dba913" />
      </NTag>
      <NTag size="small" style="color: gray">
        <template #icon>
          <NIcon :component="Chat24Regular" />
        </template>
        {{ item.commentCount }}
      </NTag>
      <NText style="font-size: large">
        {{ item.title }}
      </NText>
    </NFlex>
    <NFlex style="flex: 1; color: gray; font-size: small" justify="end" align="center">
      <template v-if="item.latestRepliedBy">
        <span>
          <NIcon :component="ArrowReply24Filled" size="15" />
          @{{ item.latestRepliedBy.name }}
        </span>
      </template>
      <template v-else> @{{ item.user?.name }} 发布于 </template>
      <NTooltip>
        <template #trigger>
          <NTime :time="item.createAt" type="relative" />
        </template>
        <NTime :time="item.createAt" />
      </NTooltip>
      <NDropdown
        v-if="forum.isAdmin"
        :options="[
          { label: '删除', key: 'delete' },
          { label: item.isPinned ? '取消置顶' : '置顶', key: 'top' },
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
