<script setup lang="ts">
  import {
    DelBiliBlackList,
    DelBlackList,
    SaveAccountSettings,
    SaveEnableFunctions,
    SaveSetting,
    downloadConfigDirect,
    useAccount,
  } from '@/api/account';
  import {
    FunctionTypes,
    ResponseUserIndexModel,
    ScheduleWeekInfo,
    SongFrom,
    SongLanguage,
    SongRequestOption,
    SongsInfo,
    VideoCollectVideo,
  } from '@/api/api-models';
  import { QueryGetAPI, QueryPostAPI } from '@/api/query';
  import DynamicForm from '@/components/DynamicForm.vue';
  import SimpleVideoCard from '@/components/SimpleVideoCard.vue';
  import {
    FETCH_API,
    IndexTemplateMap,
    ScheduleTemplateMap,
    SongListTemplateMap,
    TemplateMapType,
    USER_INDEX_API_URL,
  } from '@/data/constants';
  import { ConfigItemDefinition } from '@/data/VTsuruConfigTypes';
  import { Delete24Regular } from '@vicons/fluent';
  import {
    NAlert,
    NButton,
    NCard,
    NCheckbox,
    NCheckboxGroup,
    NDivider,
    NEmpty,
    NFlex,
    NIcon,
    NInput,
    NList,
    NListItem,
    NModal,
    NPopconfirm,
    NSelect,
    NSpace,
    NSpin,
    NTabPane,
    NTabs,
    NTag,
    NText,
    NTooltip,
    SelectOption,
    useMessage,
  } from 'naive-ui';
  import { computed, h, nextTick, onActivated, onMounted, ref, shallowRef, markRaw } from 'vue';
  import { useRoute } from 'vue-router';

  // 模板定义类型接口
  interface TemplateDefineTypes {
    TemplateMap: TemplateMapType;
    Options: SelectOption[];
    Data: any;
    Selected: string;
    Config?: any | undefined;
  }

  const accountInfo = useAccount();
  const message = useMessage();
  const route = useRoute();

  const isSaving = ref(false);
  const isLoading = ref(false);

  // 模板相关数据
  const templates = ref({
    index: {
      TemplateMap: IndexTemplateMap,
      Options: Object.entries(IndexTemplateMap).map((v) => ({
        label: v[1].name,
        value: v[0],
      })),
      Data: null,
      Selected: accountInfo.value?.settings.indexTemplate ?? '',
    },
    schedule: {
      TemplateMap: ScheduleTemplateMap,
      Options: Object.entries(ScheduleTemplateMap).map((v) => ({
        label: v[1].name,
        value: v[0],
      })),
      Data: [
        {
          year: 2023,
          week: 30,
          days: [
            {
              title: '唱唱歌!',
              tag: '歌回',
              tagColor: '#61B589',
              time: '10:00 AM',
            },
            {
              title: '玩点游戏',
              tag: '游戏',
              tagColor: '#A36565',
              time: '20:00 PM',
            },
            {
              title: 'Title 3',
              tag: 'Tag 3',
              tagColor: '#7BCDEF',
              time: '11:00 PM',
            },
            {
              title: null,
              tag: null,
              tagColor: null,
              time: null,
            },
            {
              title: null,
              tag: null,
              tagColor: null,
              time: null,
            },
            {
              title: null,
              tag: null,
              tagColor: null,
              time: null,
            },
            {
              title: null,
              tag: null,
              tagColor: null,
              time: null,
            },
          ],
        },
      ] as ScheduleWeekInfo[],
      Selected: accountInfo.value?.settings.scheduleTemplate ?? '',
    },
    songlist: {
      TemplateMap: SongListTemplateMap,
      Options: Object.entries(SongListTemplateMap).map((v) => ({
        label: v[1].name,
        value: v[0],
      })),
      Data: [
        {
          id: 1,
          key: 'song1',
          name: '歌曲1',
          author: ['作者1'],
          tags: ['标签1', '标签2'],
          description: '这是一段描述',
          url: 'https://example.com/song1.mp3',
          from: SongFrom.Custom,
          language: ['中文'],
          createTime: Date.now(),
          updateTime: Date.now(),
        },
        {
          id: 2,
          key: 'song2',
          name: '歌曲2',
          author: ['作者1'],
          tags: ['标签1', '标签2'],
          url: 'https://example.com/song2.mp3',
          from: SongFrom.Custom,
          language: ['中文'],
          createTime: Date.now(),
          updateTime: Date.now(),
          description: '这还是一段描述',
          options: {
            scMinPrice: 30,
            fanMedalMinLevel: 5,
            needJianzhang: true,
          } as SongRequestOption,
        },
        {
          id: 3,
          key: 'song3',
          name: '歌曲3',
          tags: ['标签3', '很长很长很长很长很长很长很长很长很长很长的标签'],
          author: ['作者3'],
          url: 'https://example.com/song3.mp3',
          from: SongFrom.Custom,
          description: '这是一段很长很长很长很长很长很长很长很长很长很长的描述',
          language: ['中文'],
          createTime: Date.now(),
          updateTime: Date.now(),
        },
        {
          id: 4,
          key: 'song4',
          name: '歌曲4',
          author: ['作者4'],
          url: 'https://example.com/song4.mp3',
          from: SongFrom.Custom,
          language: ['中文'],
          createTime: Date.now(),
          updateTime: Date.now(),
        },
        {
          id: 5,
          key: 'song5',
          name: '歌曲5',
          author: ['作者5'],
          tags: ['标签1', '标签5', '标签6', '标签7', '标签8', '标签9', '标签10'],
          url: 'https://example.com/song5.mp3',
          from: SongFrom.Custom,
          language: ['中文'],
          createTime: Date.now(),
          updateTime: Date.now(),
        },
      ] as SongsInfo[],
      Selected: accountInfo.value?.settings.songListTemplate ?? '',
    },
  } as { [type: string]: TemplateDefineTypes; });

  // 模板选项配置
  const templateOptions = [
    { label: '主页', value: 'index' },
    { label: '歌单', value: 'songlist' },
    { label: '日程表', value: 'schedule' },
  ] as SelectOption[];

  // 路由查询参数优先级高于默认值
  const selectedOption = ref(route.query.template?.toString() ?? 'index');
  const selectedTab = ref(route.query.setting?.toString() ?? 'general');

  // 动态表单相关
  const dynamicConfigRef = shallowRef();

  // 计算属性
  const selectedTemplateData = computed(() => templates.value[selectedOption.value]);
  const selectedTemplate = computed(() => selectedTemplateData.value.TemplateMap[selectedTemplateData.value.Selected]);
  const selectedComponent = computed(() => selectedTemplate.value.component);
  const selectedTemplateConfig = computed(() => dynamicConfigRef.value?.Config ? dynamicConfigRef.value.Config : undefined);

  // B站用户信息
  const biliUserInfo = ref();

  // 模态框控制
  const settingModalVisiable = ref(false);
  const showAddVideoModal = ref(false);
  const showAddLinkModal = ref(false);

  // 主页数据
  const indexDisplayInfo = ref<ResponseUserIndexModel>();
  const addVideoUrl = ref('');
  const addLinkName = ref('');
  const addLinkUrl = ref('');
  const linkKey = ref(0);

  /**
   * 获取B站用户数据
   */
  async function RequestBiliUserData() {
    try {
      const response = await fetch(FETCH_API + `https://workers.vrp.moe/api/bilibili/user-info/10021741`);
      const data = await response.json();
      if (data.code == 0) {
        biliUserInfo.value = data.card;
      } else {
        throw new Error('Bili User API Error: ' + data.message);
      }
    } catch (error) {
      console.error('获取B站用户数据失败:', error);
    }
  }

  /**
   * 保存功能启用状态
   */
  async function SaveComboGroupSetting(
    value: (string | number)[],
    meta: { actionType: 'check' | 'uncheck'; value: string | number; },
  ) {
    if (!accountInfo.value) return;

    isSaving.value = true;
    try {
      const response = await SaveEnableFunctions(accountInfo.value.settings.enableFunctions);
      if (response.code !== 200) {
        message.error('修改失败');
        // 回滚修改
        if (accountInfo.value) {
          accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter(
            (f) => f != (meta.value as FunctionTypes),
          );
        }
      }
    } catch (err) {
      message.error('修改失败: ' + err);
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * 保存账户设置
   */
  async function SaveComboSetting() {
    if (!accountInfo.value) return;

    isSaving.value = true;
    try {
      const response = await SaveAccountSettings();
      if (response.code === 200) {
        message.success('已保存');
      } else {
        message.error('修改失败');
      }
    } catch (err) {
      message.error('修改失败: ' + err);
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * 保存模板设置
   */
  async function SaveTemplateSetting() {
    if (!accountInfo.value) return;

    // 根据选择的模板类型保存对应设置
    switch (selectedOption.value) {
      case 'index':
        accountInfo.value.settings.indexTemplate = selectedTemplateData.value.Selected ?? '';
        break;
      case 'songlist':
        accountInfo.value.settings.songListTemplate = selectedTemplateData.value.Selected ?? '';
        break;
      case 'schedule':
        accountInfo.value.settings.scheduleTemplate = selectedTemplateData.value.Selected ?? '';
        break;
    }

    await SaveComboSetting();
  }

  /**
   * 更新主页设置
   */
  async function updateIndexSettings() {
    try {
      const response = await QueryPostAPI(USER_INDEX_API_URL + 'update-setting', accountInfo.value.settings.index);
      if (response.code === 200) {
        message.success('已保存');
      } else {
        message.error('保存失败: ' + response.message);
      }
    } catch (err) {
      message.error('保存失败: ' + err);
    }
  }

  /**
   * 添加视频到主页
   */
  async function addVideo() {
    if (!addVideoUrl.value) {
      message.error('请输入视频链接');
      return;
    }

    isLoading.value = true;
    try {
      const response = await QueryGetAPI<VideoCollectVideo>(USER_INDEX_API_URL + 'add-video', {
        video: addVideoUrl.value,
      });

      if (response.code === 200) {
        message.success('已添加');
        indexDisplayInfo.value?.videos.push(response.data);
        accountInfo.value?.settings.index.videos.push(response.data.id);
        addVideoUrl.value = '';
      } else {
        message.error('保存失败: ' + response.message);
      }
    } catch (err) {
      message.error('保存失败: ' + err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 从主页移除视频
   */
  async function removeVideo(id: string) {
    isLoading.value = true;
    try {
      const response = await QueryGetAPI<VideoCollectVideo>(USER_INDEX_API_URL + 'del-video', {
        video: id,
      });

      if (response.code === 200) {
        message.success('已删除');
        // 更新视频列表
        if (indexDisplayInfo.value) {
          indexDisplayInfo.value.videos = indexDisplayInfo.value.videos.filter((v) => v.id !== id);
        }
        // 更新设置
        accountInfo.value.settings.index.videos = accountInfo.value.settings.index.videos.filter((v) => v !== id);
      } else {
        message.error('删除失败: ' + response.message);
      }
    } catch (err) {
      message.error('删除失败: ' + err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 添加外部链接
   */
  async function addLink() {
    // 验证输入
    if (!addLinkName.value || !addLinkUrl.value) {
      message.error('请输入名称和链接');
      return;
    }

    // 验证URL格式
    try {
      new URL(addLinkUrl.value);
    } catch (e) {
      message.error('请输入正确的链接');
      return;
    }

    // 检查链接名是否已存在
    if (Object.keys(accountInfo.value.settings.index.links).includes(addLinkName.value)) {
      message.error(addLinkName.value + '已存在');
      return;
    }

    // 保存链接
    accountInfo.value.settings.index.links[addLinkName.value] = addLinkUrl.value;
    await updateIndexSettings();

    // 重置表单
    addLinkName.value = '';
    addLinkUrl.value = '';
    location.reload();
  }

  /**
   * 删除外部链接
   */
  async function removeLink(name: string) {
    delete accountInfo.value.settings.index.links[name];
    await updateIndexSettings();
    location.reload();
  }

  /**
   * 打开模板设置
   */
  async function onOpenTemplateSettings() {
    settingModalVisiable.value = true;
    nextTick(async () => {
      await getTemplateConfig();
    });
  }

  /**
   * 获取模板配置
   */
  async function getTemplateConfig() {
    // 只获取未加载且有配置名的模板
    if (selectedTemplate.value && !selectedTemplateData.value.Config && selectedTemplate.value.settingName) {
      const name = selectedTemplate.value.settingName;
      try {
        const response = await downloadConfigDirect(name);

        if (response.code === 200) {
          console.log(`已获取模板配置: ${name}`);
          selectedTemplateData.value.Config = JSON.parse(response.data);
        } else if (response.code === 404) {
          console.error(`未找到名为 ${name} 的配置文件`);
          // 使用默认配置
          selectedTemplateData.value.Config = dynamicConfigRef.value.DefaultConfig;
        } else {
          message.error('获取失败: ' + response.message);
          console.error('获取失败: ' + response.message);
        }
      } catch (err) {
        message.error((err as Error).toString());
      }
    }
  }

  // 操作按钮组
  const buttonGroup = computed(() => {
    return h(NSpace, () => [
      h(NButton, { type: 'primary', onClick: () => SaveTemplateSetting() }, () => '设为展示模板'),
      h(NButton, {
        type: 'info',
        onClick: onOpenTemplateSettings,
        disabled: !selectedTemplate.value.settingName
      }, () => '模板设置'),
    ]);
  });

  /**
   * 解除B站用户黑名单
   */
  function unblockBiliUser(id: number) {
    DelBiliBlackList(id)
      .then((data) => {
        if (data.code === 200) {
          message.success(`[${id}] 已移除黑名单`);
          if (accountInfo.value) {
            delete accountInfo.value.biliBlackList[id];
          }
        } else {
          message.error(data.message);
        }
      })
      .catch((err) => {
        message.error(err);
      });
  }

  /**
   * 解除普通用户黑名单
   */
  function unblockUser(id: number) {
    DelBlackList(id)
      .then((data) => {
        if (data.code === 200) {
          message.success(`[${id}] 已移除黑名单`);
          if (accountInfo.value) {
            accountInfo.value.blackList = accountInfo.value.blackList.filter((u) => u.id != id);
          }
        } else {
          message.error(data.message);
        }
      })
      .catch((err) => {
        message.error(err);
      });
  }

  /**
   * 获取用户主页信息
   */
  async function getIndexInfo() {
    isLoading.value = true;
    try {
      const data = await QueryGetAPI<ResponseUserIndexModel>(USER_INDEX_API_URL + 'get', { id: accountInfo.value.id });
      if (data.code === 200) {
        return data.data;
      } else if (data.code !== 404) {
        message?.error('无法获取数据: ' + data.message);
      }
      return undefined;
    } catch (err) {
      message?.error('无法获取数据: ' + err);
      return undefined;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 更新用户主页设置
   */
  async function updateUserIndexSettings() {
    await SaveSetting('Index', accountInfo.value.settings.index);
    message.success('已保存');
  }

  // 路由激活时更新选项卡
  onActivated(() => {
    if (route.query.tab) {
      selectedTab.value = route.query.setting?.toString() ?? 'general';
    }
    if (route.query.template) {
      selectedOption.value = route.query.template.toString();
    }
  });

  // 组件挂载时初始化数据
  onMounted(async () => {
    await RequestBiliUserData();
    indexDisplayInfo.value = await getIndexInfo();
    // 设置默认值
    accountInfo.value.settings.index.allowDisplayInIndex = accountInfo.value.settings.index.allowDisplayInIndex ?? true;
  });
</script>

<template>
  <NCard
    title="设置"
    :style="`${selectedTab === 'general' ? '' : 'min-height: 800px;'}`"
  >
    <NSpin :show="isSaving">
      <NTabs
        v-model:value="selectedTab"
        :default-value="$route.query.setting?.toString() ?? 'general'"
      >
        <!-- 常规设置标签页 -->
        <NTabPane
          tab="常规"
          name="general"
          display-directive="show:lazy"
        >
          <NDivider style="margin: 0">
            启用功能
          </NDivider>
          <NCheckboxGroup
            v-model:value="accountInfo.settings.enableFunctions"
            @update:value="SaveComboGroupSetting"
          >
            <NCheckbox :value="FunctionTypes.SongList">
              歌单
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.QuestionBox">
              提问箱(棉花糖
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.Schedule">
              日程
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.LiveRequest">
              点歌
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.Queue">
              排队
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.CheckInRanking">
              签到排行
            </NCheckbox>
          </NCheckboxGroup>

          <NDivider> 通知 </NDivider>
          <NSpace>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQA"
              @update:checked="SaveComboSetting"
            >
              收到新提问时发送邮件
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQAReply"
              @update:checked="SaveComboSetting"
            >
              提问收到回复时发送邮件
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.receiveOrder"
              @update:checked="SaveComboSetting"
            >
              积分礼物有新用户兑换时发送邮件
            </NCheckbox>
          </NSpace>

          <NDivider> 提问箱 </NDivider>
          <NSpace>
            <NCheckbox
              v-model:checked="accountInfo.settings.questionBox.allowUnregistedUser"
              @update:checked="SaveComboSetting"
            >
              允许未注册用户提问
            </NCheckbox>
          </NSpace>
        </NTabPane>

        <!-- 主页设置标签页 -->
        <NTabPane
          tab="主页"
          name="index"
          display-directive="show:lazy"
        >
          <NDivider> 常规 </NDivider>
          <NCheckbox
            v-model:checked="accountInfo.settings.index.allowDisplayInIndex"
            type="textarea"
            @update:checked="updateUserIndexSettings"
          >
            允许显示在网站主页
          </NCheckbox>
          <br><br>

          <NDivider> 通知 </NDivider>
          <NInput
            v-model:value="accountInfo.settings.index.notification"
            type="textarea"
          />
          <br><br>
          <NButton
            type="primary"
            @click="updateIndexSettings"
          >
            保存
          </NButton>

          <NDivider> 展示视频 </NDivider>
          <NButton
            type="primary"
            @click="showAddVideoModal = true"
          >
            添加视频
          </NButton>
          <br><br>
          <NEmpty v-if="accountInfo.settings.index.videos.length == 0" />
          <NFlex v-else>
            <NCard
              v-for="item in indexDisplayInfo?.videos ?? []"
              :key="item.id"
              style="width: 300px"
            >
              <SimpleVideoCard :video="item" />
              <template #footer>
                <NButton
                  type="warning"
                  @click="removeVideo(item.id)"
                >
                  删除
                </NButton>
              </template>
            </NCard>
          </NFlex>

          <NDivider> 其他链接 </NDivider>
          <NButton
            type="primary"
            @click="showAddLinkModal = true"
          >
            添加链接
          </NButton>
          <br><br>
          <NEmpty v-if="Object.entries(indexDisplayInfo?.links ?? {}).length == 0" />
          <NFlex
            v-else
            :key="linkKey"
          >
            <NFlex
              v-for="item in Object.entries(indexDisplayInfo?.links ?? {})"
              :key="item[0]"
              align="center"
            >
              <NTooltip>
                <template #trigger>
                  <NTag
                    :bordered="false"
                    size="small"
                    type="info"
                  >
                    {{ item[0] }}
                  </NTag>
                </template>
                {{ item[1] }}
              </NTooltip>
              <NPopconfirm @positive-click="removeLink(item[0])">
                <template #trigger>
                  <NButton
                    type="error"
                    text
                  >
                    <template #icon>
                      <NIcon :component="Delete24Regular" />
                    </template>
                  </NButton>
                </template>
                确定要删除这个链接吗?
              </NPopconfirm>
            </NFlex>
          </NFlex>
        </NTabPane>

        <!-- 黑名单标签页 -->
        <NTabPane
          tab="黑名单"
          name="blacklist"
          display-directive="show:lazy"
        >
          <!-- B站黑名单列表 -->
          <NList v-if="accountInfo.biliBlackList && Object.keys(accountInfo.biliBlackList).length > 0">
            <NListItem
              v-for="item in Object.entries(accountInfo.biliBlackList)"
              :key="item[0]"
            >
              <NSpace align="center">
                <NText>
                  {{ item[1] }}
                </NText>
                <NText depth="3">
                  {{ item[0] }}
                </NText>
                <NButton
                  type="error"
                  size="small"
                  @click="unblockBiliUser(Number(item[0]))"
                >
                  移除
                </NButton>
              </NSpace>
            </NListItem>
          </NList>

          <!-- 普通用户黑名单列表 -->
          <NList v-if="accountInfo.blackList && accountInfo.blackList.length > 0">
            <NListItem
              v-for="item in accountInfo.blackList"
              :key="item.id"
            >
              <NSpace align="center">
                <NText>
                  {{ item.name }}
                </NText>
                <NText depth="3">
                  {{ item.id }}
                </NText>
                <NButton
                  type="error"
                  size="small"
                  @click="unblockUser(Number(item.id))"
                >
                  移除
                </NButton>
              </NSpace>
            </NListItem>
          </NList>
          <NEmpty v-else />
        </NTabPane>

        <!-- 模板设置标签页 -->
        <NTabPane
          tab="模板"
          name="template"
          display-directive="show:lazy"
        >
          <NAlert type="success">
            如果有合适的设计稿或者想法可以给我说然后做成模板捏
          </NAlert>
          <br>
          <NSpace vertical>
            <NSpace align="center">
              页面
              <NSelect
                v-model:value="selectedOption"
                :options="templateOptions"
                style="width: 150px"
              />
            </NSpace>
            <NDivider
              style="margin: 5px 0 5px 0"
              title-placement="left"
            >
              模板
            </NDivider>
            <div>
              <NSpace>
                <NSelect
                  v-model:value="selectedTemplateData.Selected"
                  style="width: 150px"
                  :options="selectedTemplateData.Options"
                />
                <component :is="buttonGroup" />
              </NSpace>
              <NDivider />
              <Transition
                name="fade"
                mode="out-in"
              >
                <div
                  v-if="selectedComponent"
                  :key="selectedTemplateData.Selected"
                >
                  <component
                    :is="selectedComponent"
                    ref="dynamicConfigRef"
                    :user-info="accountInfo"
                    :bili-info="biliUserInfo"
                    :data="selectedTemplateData.Data"
                    :config="selectedTemplateData.Config"
                    @vue:mounted="getTemplateConfig"
                  />
                </div>
              </Transition>
            </div>
          </NSpace>
        </NTabPane>
      </NTabs>
    </NSpin>
  </NCard>

  <!-- 模板设置模态框 -->
  <NModal
    v-model:show="settingModalVisiable"
    preset="card"
    closable
    style="width: 1200px; max-width: 90vw"
    title="模板设置"
  >
    <NSpin
      v-if="!selectedTemplateData.Config"
      show
    />
    <DynamicForm
      v-else
      :key="selectedTemplateData.Selected"
      :name="selectedTemplateData.TemplateMap[selectedTemplateData.Selected].settingName"
      :config-data="selectedTemplateData.Config"
      :config="selectedTemplateConfig"
    />
  </NModal>

  <!-- 添加视频模态框 -->
  <NModal
    v-model:show="showAddVideoModal"
    preset="card"
    closable
    style="width: 600px; max-width: 90vw"
    title="添加视频"
  >
    <NInput
      v-model:value="addVideoUrl"
      placeholder="请输入视频链接"
    />
    <NDivider />
    <NButton
      type="primary"
      :loading="isLoading"
      @click="addVideo"
    >
      添加视频
    </NButton>
  </NModal>

  <!-- 添加链接模态框 -->
  <NModal
    v-model:show="showAddLinkModal"
    preset="card"
    closable
    style="width: 600px; max-width: 90vw"
    title="添加链接"
  >
    <NFlex vertical>
      <NInput
        v-model:value="addLinkName"
        placeholder="链接名称"
      />
      <NInput
        v-model:value="addLinkUrl"
        placeholder="链接地址"
      />
      <NButton
        type="primary"
        @click="addLink"
      >
        添加
      </NButton>
    </NFlex>
  </NModal>
</template>
