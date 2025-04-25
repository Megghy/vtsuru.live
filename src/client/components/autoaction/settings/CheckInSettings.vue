<template>
  <NCard
    v-if="config"
    title="弹幕签到设置"
    size="small"
  >
    <NTabs
      type="line"
      animated
    >
      <NTabPane
        name="settings"
        tab="签到设置"
      >
        <NForm
          label-placement="left"
          label-width="auto"
        >
          <NFormItem label="启用签到功能">
            <NSwitch v-model:value="config.enabled" />
          </NFormItem>

          <template v-if="config.enabled">
            <NFormItem label="签到指令">
              <NInput
                v-model:value="config.command"
                placeholder="例如：签到"
              />
              <template #feedback>
                观众发送此指令触发签到。
              </template>
            </NFormItem>

            <NFormItem label="仅在直播时可签到">
              <NSwitch v-model:value="config.onlyDuringLive" />
              <template #feedback>
                启用后，仅在直播进行中才能签到，否则任何时候都可以签到。
              </template>
            </NFormItem>

            <NFormItem label="发送签到回复">
              <NSwitch v-model:value="config.sendReply" />
              <template #feedback>
                启用后，签到成功或重复签到时会发送弹幕回复，关闭则只显示通知不发送弹幕。
              </template>
            </NFormItem>

            <NFormItem label="签到成功获得积分">
              <NInputNumber
                v-model:value="config.points"
                :min="0"
                style="width: 100%"
              />
            </NFormItem>

            <NFormItem label="用户签到冷却时间 (秒)">
              <NInputNumber
                v-model:value="config.cooldownSeconds"
                :min="0"
                style="width: 100%"
              />
              <template #feedback>
                每个用户在指定秒数内签到命令只会响应一次
              </template>
            </NFormItem>

            <NDivider title-placement="left">
              回复消息设置
            </NDivider>

            <!-- 签到模板帮助信息组件 -->
            <div style="margin-bottom: 12px">
              <TemplateHelper :placeholders="checkInPlaceholders" />
              <NAlert
                type="info"
                :show-icon="false"
                style="margin-top: 8px"
              >
                <template #header>
                  <div
                    style="display: flex; align-items: center; font-weight: bold"
                  >
                    <NIcon
                      :component="Info24Filled"
                      style="margin-right: 4px"
                    />
                    签到模板可用变量列表
                  </div>
                </template>
              </NAlert>
            </div>

            <!-- 使用 AutoActionEditor 编辑 action 配置 -->
            <AutoActionEditor
              :action="config.successAction"
              :hide-name="true"
              :hide-enabled="true"
            />
            <AutoActionEditor
              :action="config.cooldownAction"
              :hide-name="true"
              :hide-enabled="true"
            />

            <NDivider title-placement="left">
              早鸟奖励设置
            </NDivider>

            <NFormItem label="启用早鸟奖励">
              <NSwitch v-model:value="config.earlyBird.enabled" />
              <template #feedback>
                在直播开始后的一段时间内签到可获得额外奖励。
              </template>
            </NFormItem>

            <template v-if="config.earlyBird.enabled">
              <NFormItem label="早鸟时间窗口 (分钟)">
                <NInputNumber
                  v-model:value="config.earlyBird.windowMinutes"
                  :min="1"
                  style="width: 100%"
                />
                <template #feedback>
                  直播开始后多少分钟内视为早鸟。
                </template>
              </NFormItem>

              <NFormItem label="早鸟额外奖励积分">
                <NInputNumber
                  v-model:value="config.earlyBird.bonusPoints"
                  :min="0"
                  style="width: 100%"
                />
                <template #feedback>
                  成功触发早鸟签到的用户额外获得的积分。
                </template>
              </NFormItem>
              <AutoActionEditor
                :action="config.earlyBird.successAction"
                :hide-name="true"
                :hide-enabled="true"
              />
            </template>
          </template>
        </NForm>
      </NTabPane>

      <NTabPane
        name="userStats"
        tab="用户签到情况"
      >
        <div class="checkin-stats">
          <NSpace vertical>
            <NAlert type="info">
              以下显示用户的签到统计信息。包括累计签到次数、连续签到天数和早鸟签到次数等。
            </NAlert>

            <NDataTable
              :columns="userStatsColumns"
              :data="userStatsData"
              :pagination="{ pageSize: 10 }"
              :bordered="false"
              striped
            />

            <NEmpty
              v-if="!userStatsData.length"
              description="暂无用户签到数据"
            />
          </NSpace>
        </div>
      </NTabPane>

      <NTabPane
        name="testCheckIn"
        tab="测试签到"
      >
        <div class="test-checkin">
          <NSpace vertical>
            <NAlert type="info">
              在此可以模拟用户签到，测试签到功能是否正常工作。
            </NAlert>

            <NForm>
              <NFormItem label="用户UID">
                <NInputNumber
                  v-model:value="testUid"
                  :min="1"
                  style="width: 100%"
                  placeholder="输入用户数字ID"
                />
              </NFormItem>
              <NFormItem label="用户名">
                <NInput
                  v-model:value="testUsername"
                  placeholder="输入用户名，默认为'测试用户'"
                />
              </NFormItem>
              <NFormItem>
                <NButton
                  type="primary"
                  :disabled="!testUid || !config?.enabled"
                  @click="handleTestCheckIn"
                >
                  模拟签到
                </NButton>
              </NFormItem>
            </NForm>

            <NDivider title-placement="left">
              测试结果
            </NDivider>

            <NCard
              v-if="testResult"
              size="small"
              :title="testResult.success ? '签到成功' : '签到失败'"
            >
              <NText>{{ testResult.message }}</NText>
            </NCard>
          </NSpace>
        </div>
      </NTabPane>
    </NTabs>

    <NText
      :depth="3"
      style="font-size: 12px; margin-top: 15px; display: block"
    >
      提示：签到成功发送的回复消息会遵循全局的弹幕发送设置（如频率限制、弹幕长度等）。
    </NText>
  </NCard>
  <NCard
    v-else
    title="加载中..."
    size="small"
  >
    <NText>正在加载签到设置...</NText>
  </NCard>
</template>

<script lang="ts" setup>
import { NCard, NForm, NFormItem, NSwitch, NInput, NInputNumber, NSpace, NText, NDivider, NAlert, NIcon, NTabs, NTabPane, NDataTable, NEmpty, NButton } from 'naive-ui';
import { useAutoAction } from '@/client/store/useAutoAction';
import TemplateEditor from '../TemplateEditor.vue';
import TemplateHelper from '../TemplateHelper.vue';
import { TriggerType, ActionType, Priority, RuntimeState } from '@/client/store/autoAction/types';
import { EventModel, EventDataTypes } from '@/api/api-models';
import { Info24Filled } from '@vicons/fluent';
import { computed, h, ref } from 'vue';
import type { UserCheckInData } from '@/client/store/autoAction/modules/checkin';
import AutoActionEditor from '../AutoActionEditor.vue';

const autoActionStore = useAutoAction();
const config = autoActionStore.checkInModule.checkInConfig;
const checkInStorage = autoActionStore.checkInModule.checkInStorage;

// 签到模板的特定占位符
const checkInPlaceholders = [
  { name: '{{checkin.points}}', description: '基础签到积分' },
  { name: '{{checkin.bonusPoints}}', description: '早鸟额外积分 (普通签到为0)' },
  { name: '{{checkin.totalPoints}}', description: '本次总获得积分' },
  { name: '{{checkin.userPoints}}', description: '用户当前积分' },
  { name: '{{checkin.isEarlyBird}}', description: '是否是早鸟签到 (true/false)' },
  { name: '{{checkin.cooldownSeconds}}', description: '签到冷却时间(秒)' },
  { name: '{{checkin.time}}', description: '签到时间对象' }
];

// 为签到模板自定义的测试上下文
const checkInTestContext = computed(() => {
  if (!config) return undefined;

  return {
    checkin: {
      points: config.points || 0,
      bonusPoints: config.earlyBird.enabled ? config.earlyBird.bonusPoints : 0,
      totalPoints: (config.points || 0) + (config.earlyBird.enabled ? config.earlyBird.bonusPoints : 0),
      userPoints: 1000, // 模拟用户当前积分
      isEarlyBird: false,
      cooldownSeconds: config.cooldownSeconds || 0,
      time: new Date()
    }
  };
});

// 用户签到数据表格列定义
const userStatsColumns = [
  {
    title: '用户ID',
    key: 'uid'
  },
  {
    title: '用户名',
    key: 'username'
  },
  {
    title: '首次签到时间',
    key: 'firstCheckInTime',
    render(row: UserCheckInData) {
      return h('span', {}, new Date(row.firstCheckInTime).toLocaleString());
    }
  },
  {
    title: '最近签到时间',
    key: 'lastCheckInTime',
    sorter: true,
    defaultSortOrder: 'descend' as const,
    render(row: UserCheckInData) {
      return h('span', {}, new Date(row.lastCheckInTime).toLocaleString());
    }
  },
  {
    title: '累计签到',
    key: 'totalCheckins',
    sorter: true
  },
  {
    title: '连续签到',
    key: 'streakDays',
    sorter: true
  },
  {
    title: '早鸟签到次数',
    key: 'earlyBirdCount',
    sorter: true
  }
];

// 转换用户签到数据为表格可用格式
const userStatsData = computed<UserCheckInData[]>(() => {
  if (!checkInStorage?.users) {
    return [];
  }

  // 将对象转换为数组
  return Object.values(checkInStorage.users);
});

// 测试签到功能
const testUid = ref<number>();
const testUsername = ref<string>('测试用户');
const testResult = ref<{ success: boolean; message: string }>();

// 处理测试签到
async function handleTestCheckIn() {
  if (!testUid.value || !config?.enabled) {
    testResult.value = {
      success: false,
      message: '请输入有效的UID或确保签到功能已启用'
    };
    return;
  }

  try {
    // 创建唯一标识符ouid，基于用户输入的uid
    const userOuid = testUid.value.toString();

    // 创建模拟的事件对象
    const mockEvent: EventModel = {
      type: EventDataTypes.Message,
      uname: testUsername.value || '测试用户',
      uface: '',
      uid: testUid.value,
      open_id: '',
      msg: config.command,
      time: Date.now(),
      num: 0,
      price: 0,
      guard_level: 0,
      fans_medal_level: 0,
      fans_medal_name: '',
      fans_medal_wearing_status: false,
      ouid: userOuid
    };

    // 创建模拟的运行时状态
    const mockRuntimeState: RuntimeState = {
      lastExecutionTime: {},
      aggregatedEvents: {},
      scheduledTimers: {},
      timerStartTimes: {},
      globalTimerStartTime: null,
      sentGuardPms: new Set<number>()
    };

    // 处理签到请求
    await autoActionStore.checkInModule.processCheckIn(mockEvent, mockRuntimeState);

    testResult.value = {
      success: true,
      message: `已为用户 ${testUsername.value || '测试用户'}(UID: ${testUid.value}) 模拟签到操作，请查看用户签到情况选项卡确认结果`
    };
  } catch (error) {
    testResult.value = {
      success: false,
      message: `签到操作失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
</script>
