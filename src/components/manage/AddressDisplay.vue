<script setup lang="ts">
import { AddressInfo } from '@/api/api-models'
import { useElementSize } from '@vueuse/core'
import { NButton, NFlex, NPopconfirm, NTag, NText } from 'naive-ui'
import { ref } from 'vue'

const { size = 'default' } = defineProps<{
  address: AddressInfo | undefined
  size?: 'small' | 'default'
}>()

const elementRef = ref()

const { height } = useElementSize(elementRef.value)
</script>

<template>
  <NText
    v-if="!address"
    depth="3"
    italic
  >
    未知
  </NText>
  <NFlex
    v-else
    ref="elementRef"
  >
    <NFlex
      vertical
      :size="5"
    >
      <NText v-if="size != 'small'">
        {{ address.province }}
        <NText depth="3">
          省
        </NText>
        {{ address.city }}
        <NText depth="3">
          市
        </NText>
        {{ address.district }}
        <NText depth="3">
          区
        </NText>
        {{ address.street }}
      </NText>
      <NText depth="3">
        <NFlex align="center">
          <NTag
            size="tiny"
            type="info"
            :bordered="false"
          >
            详细地址
          </NTag>
          <NEllipsis :style="{ maxWidth: size == 'small' ? '120px' : '1000px' }">
            {{ address.address }}
          </NEllipsis>
        </NFlex>
      </NText>
      <NText
        v-if="size != 'small'"
        depth="3"
      >
        <NFlex align="center">
          <NTag
            size="tiny"
            type="info"
            :bordered="false"
          >
            收货人
          </NTag>
          <span> {{ address.phone }} {{ address.name }} </span>
        </NFlex>
      </NText>
    </NFlex>
    <NFlex
      style="flex: 1"
      justify="end"
      align="center"
    >
      <slot name="actions" />
    </NFlex>
  </NFlex>
</template>
