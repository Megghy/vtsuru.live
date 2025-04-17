<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NTabs, NTabPane, NCard, NSpace, NScrollbar } from 'naive-ui';
import { useAutoAction } from '@/client/store/useAutoAction';
import GiftThankConfig from './components/autoaction/GiftThankConfig.vue';
import GuardPmConfig from './components/autoaction/GuardPmConfig.vue';
import FollowThankConfig from './components/autoaction/FollowThankConfig.vue';
import EntryWelcomeConfig from './components/autoaction/EntryWelcomeConfig.vue';
import ScheduledDanmakuConfig from './components/autoaction/ScheduledDanmakuConfig.vue';
import AutoReplyConfig from './components/autoaction/AutoReplyConfig.vue';

const autoActionStore = useAutoAction();

// 当前激活的标签页
const activeTab = ref('gift-thank');

// 在组件挂载后初始化自动操作模块
onMounted(() => {
  //autoActionStore.init();
});

</script>

<template>
  <NCard
    title="自动操作设置"
    size="small"
  >
    <NAlert
      type="warning"
      show-icon
      closable
      style="margin-bottom: 16px;"
    >
      施工中
    </NAlert>
    <NTabs
      v-model:value="activeTab"
      type="line"
      animated
    >
      <NTabPane
        name="gift-thank"
        tab="礼物感谢"
      >
        <GiftThankConfig :config="autoActionStore.giftThankConfig" />
      </NTabPane>

      <NTabPane
        name="guard-pm"
        tab="上舰私信"
      >
        <GuardPmConfig :config="autoActionStore.guardPmConfig" />
      </NTabPane>

      <NTabPane
        name="follow-thank"
        tab="关注感谢"
      >
        <FollowThankConfig :config="autoActionStore.followThankConfig" />
      </NTabPane>

      <NTabPane
        name="entry-welcome"
        tab="入场欢迎"
      >
        <EntryWelcomeConfig :config="autoActionStore.entryWelcomeConfig" />
      </NTabPane>

      <NTabPane
        name="scheduled-danmaku"
        tab="定时弹幕"
      >
        <ScheduledDanmakuConfig :config="autoActionStore.scheduledDanmakuConfig" />
      </NTabPane>

      <NTabPane
        name="auto-reply"
        tab="自动回复"
      >
        <AutoReplyConfig :config="autoActionStore.autoReplyConfig" />
      </NTabPane>
    </NTabs>
  </NCard>
</template>

<style scoped>
.config-description {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
}
</style>