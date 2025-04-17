<script setup lang="ts">
import { NSpace, NSwitch, NInputNumber, NSelect, NCheckbox, NDivider } from 'naive-ui';

defineProps({
  config: {
    type: Object,
    required: true
  },
  showLiveOnly: {
    type: Boolean,
    default: true
  },
  showDelay: {
    type: Boolean,
    default: false
  },
  showUserFilter: {
    type: Boolean,
    default: false
  },
  showTianXuan: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <div class="common-config-section">
    <NSpace
      vertical
      size="medium"
    >
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>启用功能:</span>
        <NSwitch v-model:value="config.enabled" />
      </NSpace>

      <NSpace
        v-if="showLiveOnly"
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>仅直播中开启:</span>
        <NSwitch v-model:value="config.onlyDuringLive" />
      </NSpace>

      <NSpace
        v-if="showDelay"
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>延迟时间 (秒):</span>
        <NInputNumber
          v-model:value="config.delaySeconds"
          :min="0"
          :max="300"
          style="width: 120px"
        />
      </NSpace>

      <NSpace
        v-if="showTianXuan"
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>屏蔽天选时刻:</span>
        <NSwitch v-model:value="config.ignoreTianXuan" />
      </NSpace>

      <template v-if="showUserFilter">
        <NDivider title-placement="left">
          用户过滤设置
        </NDivider>

        <NSpace
          align="center"
          justify="space-between"
          style="width: 100%"
        >
          <span>启用用户过滤:</span>
          <NSwitch v-model:value="config.userFilterEnabled" />
        </NSpace>

        <NSpace
          v-if="config.userFilterEnabled"
          align="center"
          justify="space-between"
          style="width: 100%"
        >
          <span>要求本房间勋章:</span>
          <NSwitch v-model:value="config.requireMedal" />
        </NSpace>

        <NSpace
          v-if="config.userFilterEnabled"
          align="center"
          justify="space-between"
          style="width: 100%"
        >
          <span>要求任意舰长:</span>
          <NSwitch v-model:value="config.requireCaptain" />
        </NSpace>
      </template>
    </NSpace>
  </div>
</template>

<style scoped>
.common-config-section {
  padding: 16px 0;
}
</style>
