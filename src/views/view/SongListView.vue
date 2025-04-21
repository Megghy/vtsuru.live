<template>
  <div>
    <NSpin :show="isLoading">
      <component
        :is="selectedTemplate?.component"
        ref="dynamicConfigRef"
        :config="selectedTemplate?.settingName ? currentConfig : undefined"
        :user-info="userInfo"
        :bili-info="biliInfo"
        :data="currentData"
        :live-request-settings="settings"
        :live-request-active="songsActive"
        v-bind="$attrs"
        @request-song="requestSong"
      />
    </NSpin>
    <NButton
      v-if="selectedTemplate?.settingName && userInfo?.id == accountInfo.id"
      type="info"
      size="small"
      style="position: absolute; right: 32px; top: 20px; z-index: 1000; border: solid 3px #dfdfdf;"
      @click="showSettingModal = true"
    >
      自定义
    </NButton>
    <NModal
      v-model:show="showSettingModal"
      style="max-width: 90vw; width: 800px;"
      preset="card"
      title="设置"
    >
      <DynamicForm
        :name="selectedTemplate?.settingName"
        :config-data="currentConfig"
        :config="selectedTemplateConfig"
      />
    </NModal>
  </div>
</template>

<script lang="ts" setup>
  import { DownloadConfig, useAccount } from '@/api/account';
import { Setting_LiveRequest, SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models';
import { QueryGetAPI, QueryPostAPIWithParams } from '@/api/query';
import { SONG_API_URL, SONG_REQUEST_API_URL, SongListTemplateMap } from '@/data/constants';
import { ConfigItemDefinition } from '@/data/VTsuruTypes';
import { useStorage } from '@vueuse/core';
import { addSeconds } from 'date-fns';
import { NButton, NModal, NSpin, useMessage, NFlex, NIcon, NInput, NInputGroup, NInputGroupLabel, NTag, NTooltip, NSelect, NSpace } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { GetGuardColor, getUserAvatarUrl, isDarkMode } from '@/Utils';

  const accountInfo = useAccount();
  const nextRequestTime = useStorage('SongList.NextRequestTime', new Date());

  const minRequestTime = 30;
  const showSettingModal = ref(false);

  const props = defineProps<{
    biliInfo: any | undefined;
    userInfo: UserInfo | undefined;
    template?: string | undefined;
    fakeData?: SongsInfo[];
  }>();

  const componentType = computed(() => {
    return props.template ?? props.userInfo?.extra?.templateTypes['songlist']?.toLowerCase();
  });
  const currentData = ref<SongsInfo[]>();
  const dynamicConfigRef = ref();
  const selectedTemplateConfig = computed(() => {
    if (dynamicConfigRef.value?.Config) {
      return dynamicConfigRef.value?.Config as ConfigItemDefinition[];
    }
    return undefined;
  });
  const selectedTemplate = computed(() => {
    if (componentType.value) {
      return SongListTemplateMap[componentType.value];
    }
    return SongListTemplateMap[''];
  });
  const currentConfig = ref();

  const isDataLoading = ref(true);
  const isConfigLoading = ref(true);
  const isLoading = computed(() => isDataLoading.value || isConfigLoading.value);

  const message = useMessage();

  const errMessage = ref('');
  const songsActive = ref<SongRequestInfo[]>([]);
  const settings = ref<Setting_LiveRequest>({} as Setting_LiveRequest);

  async function getSongRequestInfo() {
    try {
      const data = await QueryGetAPI<{ songs: SongRequestInfo[]; setting: Setting_LiveRequest; }>(
        SONG_REQUEST_API_URL + 'get-active-and-settings',
        {
          id: props.userInfo?.id,
        },
      );
      if (data.code == 200) {
        return data.data;
      }
    } catch (err) { }
    return {} as { songs: SongRequestInfo[]; setting: Setting_LiveRequest; };
  }
  async function getSongs() {
    isDataLoading.value = true;
    await QueryGetAPI<SongsInfo[]>(SONG_API_URL + 'get', {
      id: props.userInfo?.id,
    })
      .then((data) => {
        if (data.code == 200) {
          currentData.value = data.data;
        } else {
          errMessage.value = data.message;
          message.error('加载歌单失败: ' + data.message);
        }
      })
      .catch((err) => {
        message.error('加载失败: ' + err);
      })
      .finally(() => {
        isDataLoading.value = false;
      });
  }
  async function getConfig() {
    if (!selectedTemplateConfig.value || !selectedTemplate.value!.settingName) {
        if (!selectedTemplate.value!.settingName) {
             isConfigLoading.value = false;
        }
        return;
    }

    isConfigLoading.value = true;
    try {
        const data = await DownloadConfig(selectedTemplate.value!.settingName, props.userInfo?.id);
        if (data.msg) {
            currentConfig.value = dynamicConfigRef.value?.DefaultConfig ?? {};
        } else {
            currentConfig.value = data.data;
        }
    } catch (err) {
        message.error('加载配置失败: ' + err);
    } finally {
        isConfigLoading.value = false;
    }
  }
  async function requestSong(song: SongsInfo) {
    if (song.options || !settings.value.allowFromWeb || (settings.value.allowFromWeb && !settings.value.allowAnonymousFromWeb)) {
      navigator.clipboard.writeText(`${settings.value.orderPrefix} ${song.name}`);
      if (!settings.value.allowAnonymousFromWeb) {
        message.warning('主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点歌弹幕已复制到剪切板');
      }
      else if (!accountInfo.value.id) {
        message.warning('要从网页点歌请先登录, 点歌弹幕已复制到剪切板');
      } else {
        message.success('复制成功');
      }
    } else {
      if (props.userInfo) {
        if (!accountInfo.value.id && nextRequestTime.value > new Date()) {
          message.warning('距离点歌冷却还有' + (nextRequestTime.value.getTime() - new Date().getTime()) / 1000 + '秒');
          return;
        }
        try {
          const data = await QueryPostAPIWithParams(SONG_REQUEST_API_URL + 'add-from-web', {
            target: props.userInfo?.id,
            song: song.key,
          });

          if (data.code == 200) {
            message.success('点歌成功');
            nextRequestTime.value = addSeconds(new Date(), minRequestTime);
          } else {
            message.error('点歌失败: ' + data.message);
          }
        } catch (err) {
          message.error('点歌失败: ' + err);
        }
      }
    }
  }

  watch(
    () => dynamicConfigRef.value,
    (newValue) => {
      if (newValue?.Config) {
        getConfig();
      }
    },
    { immediate: false }
  );

  onMounted(async () => {
    isDataLoading.value = true;
    if (!props.fakeData) {
      try {
        await getSongs();
        const r = await getSongRequestInfo();
        if (r) {
          songsActive.value = r.songs;
          settings.value = r.setting;
        }

      } catch (err) {
        message.error('加载失败: ' + err);
        console.error(err);
        isDataLoading.value = false;
        isConfigLoading.value = false;
      }
    } else {
      currentData.value = props.fakeData;
      isDataLoading.value = false;
      isConfigLoading.value = false;
    }

    if (!selectedTemplate.value?.settingName) {
       isConfigLoading.value = false;
    }
  });
</script>
