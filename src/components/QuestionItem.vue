<script setup lang="ts">
import type { QAInfo } from '@/api/api-models'
import { NCard, NCheckbox, NDivider, NFlex, NImage, NTag, NText, NTime, NTooltip } from 'naive-ui'
import { ref } from 'vue'
import { useQuestionBox } from '@/store/useQuestionBox'

const props = defineProps<{
  item: QAInfo
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{ (e: 'select', id: number): void }>()
const useQA = useQuestionBox()

const isViolation = props.item.reviewResult?.isApproved === false
const showContent = ref(!isViolation)

function getScoreColor(score: number | undefined): string {
  if (score === undefined) return 'grey'
  const clamped = Math.max(0, Math.min(100, score))
  const hue = 120 * (clamped / 100)
  return `hsl(${hue}, 50%, 45%)`
}
</script>

<template>
  <NCard v-if="item" :embedded="!item.isReaded" hoverable size="small" :bordered="false">
    <template #header>
      <NFlex :size="[4, 4]" align="center" wrap>
        <NCheckbox
          v-if="selectable"
          :checked="selected"
          style="margin-right: 4px;"
          @update:checked="emit('select', item.id)"
          @click.stop
        />
        <NTag v-if="!item.isReaded" type="warning" size="tiny">未读</NTag>
        <NDivider v-if="!item.isReaded" vertical />
        <NText :depth="item.isAnonymous ? 3 : 1">
          {{ item.isAnonymous ? (item.anonymousName || '匿名用户') : item.sender?.name }}
        </NText>
        <NTag v-if="item.isSenderRegisted" size="small" type="info" :bordered="false">已注册</NTag>
        <NTag v-if="item.isPublic" size="small" type="success" :bordered="false">公开</NTag>
        <NTooltip v-if="item.tag">
          <template #trigger>
            <NTag size="small" type="success">{{ item.tag }}</NTag>
          </template>
          标签/话题
        </NTooltip>
        <NDivider vertical />
        <NText depth="3" style="font-size: small">
          <NTooltip>
            <template #trigger>
              <NTime :time="item.sendAt" :to="Date.now()" type="relative" />
            </template>
            <NTime :time="item.sendAt" />
          </NTooltip>
        </NText>
        <template v-if="item.reviewResult && item.reviewResult.violationType?.length > 0">
          <NDivider vertical />
          <NFlex size="small" wrap>
            <NTag v-for="v in item.reviewResult.violationType" :key="v" size="small" type="error" :bordered="false">
              {{ useQA.getViolationString(v) }}
            </NTag>
          </NFlex>
        </template>
        <template v-if="item.reviewResult && item.reviewResult.saftyScore !== undefined">
          <NDivider vertical />
          <NTooltip>
            <template #trigger>
              <NTag size="small" :style="{ backgroundColor: getScoreColor(item.reviewResult.saftyScore), color: 'white', borderColor: 'transparent' }">
                得分: {{ item.reviewResult.saftyScore }}
              </NTag>
            </template>
            审查得分, 满分100, 越低越安全
          </NTooltip>
        </template>
      </NFlex>
    </template>
    <template #footer>
      <slot name="footer" :item="item" />
    </template>
    <template #header-extra>
      <slot name="header-extra" :item="item" />
    </template>
    <template v-if="item.questionImages && item.questionImages.length > 0">
      <NFlex size="small">
        <NImage v-for="(img, index) in item.questionImages" :key="index" :src="img.path" height="100" lazy />
      </NFlex>
    </template>

    <NText
      :style="{
        filter: isViolation && !showContent ? 'blur(3.7px)' : '',
        cursor: isViolation && !showContent ? 'pointer' : '',
        whiteSpace: 'pre-wrap',
      }"
      @click="isViolation ? (showContent = !showContent) : null"
    >
      {{ item.question?.message }}
    </NText>

    <template v-if="item.answer">
      <NDivider style="margin: 10px 0" />
      <NText depth="3">{{ item.answer.message }}</NText>
    </template>
  </NCard>
</template>
