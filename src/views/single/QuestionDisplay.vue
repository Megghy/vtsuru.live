<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { useAccount } from '@/api/account'
import { QuestionDisplayAlign, Setting_QuestionDisplay } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import QuestionItem from '@/components/QuestionItem.vue'
import QuestionItems from '@/components/QuestionItems.vue'
import { QUESTION_API_URL } from '@/data/constants'
import { useQuestionBox } from '@/store/useQuestionBox'
import QuestionDisplayCard from '@/views/manage/QuestionDisplayCard.vue'
import {
  ArrowCircleLeft12Filled,
  ArrowCircleRight12Filled,
  Info24Filled,
  TextAlignCenter16Filled,
  TextAlignLeft16Filled,
  TextAlignRight16Filled,
} from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { useDebounceFn, useElementSize, useStorage } from '@vueuse/core'
import {
  NButton,
  NCard,
  NCheckbox,
  NColorPicker,
  NDivider,
  NDrawer,
  NDrawerContent,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NModal,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'

const message = useMessage()
const accountInfo = useAccount()
const defaultSettings = {} as Setting_QuestionDisplay
const useQB = useQuestionBox()

const showSettingDrawer = ref(false)
const showGreenBorder = ref(false)
const showOBSModal = ref(false)

const isLoading = ref(false)

const cardRef = ref<HTMLElement>()
const cardSize = useElementSize(cardRef)
const savedCardSize = useStorage<{ width: number; height: number }>('Settings.QuestionDisplay.CardSize', {
  width: 400,
  height: 400,
})
const customCss = useStorage<string>('Settings.QuestionDisplay.CustomCss', '')

const debouncedSize = useDebounceFn(() => {
  savedCardSize.value = { width: cardSize.width.value, height: cardSize.height.value }
}, 500)
watch([cardSize.width, cardSize.height], () => {
  if (cardSize.width.value > 300 && cardSize.height.value > 300) {
    debouncedSize()
  }
})

const setting = computed({
  get: () => {
    if (accountInfo.value && accountInfo.value.settings) {
      return accountInfo.value.settings.questionDisplay
    }
    return defaultSettings
  },
  set: (value) => {
    if (accountInfo.value) {
      accountInfo.value.settings.questionDisplay = value
    }
  },
})
async function updateSettings() {
  if (accountInfo.value) {
    isLoading.value = true
    await QueryPostAPI(QUESTION_API_URL + 'update-setting', setting.value)
      .then((data) => {
        if (data.code == 200) {
          //message.success('已保存')
        } else {
          message.error('保存失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('保存失败')
      })
      .finally(() => {
        isLoading.value = false
      })
  } else {
    message.success('完成')
  }
}
const fontsOptions = useStorage<{ label: string; value: string }[]>('Settings.Fonts', [])
async function loadFonts() {
  if ('queryLocalFonts' in window) {
    //@ts-expect-error 不知道为啥不存在
    const status = await navigator.permissions.query({ name: 'local-fonts' })
    if (status.state === 'granted') {
      console.log('Permission was granted 👍')
    } else if (status.state === 'prompt') {
      console.log('Permission will be requested')
    } else {
      console.log('Permission was denied 👎')
      message.error('你没有授予本地字体权限, 无法读取本地字体')
    }
    //@ts-expect-error 不知道为啥不存在
    const fonts = await window.queryLocalFonts()
    fontsOptions.value = fonts.map((f: any) => {
      return { label: f.fullName, value: f.fullName }
    })
    message.success('已获取字体列表, 共' + fontsOptions.value.length + '个字体')
  } else {
    message.error('你的浏览器不支持获取字体列表')
  }
}

onMounted(() => {
  useQB.GetRecieveQAInfo()

  useQB.displayQuestion = useQB.recieveQuestions.find(
    (s) => s.id == accountInfo.value?.settings.questionDisplay.currentQuestion,
  )
})
</script>

<template>
  <NFlex :wrap="false" style="margin: 20px">
    <NFlex style="height: calc(100vh - 40px)" :wrap="false" vertical>
      <NCard size="small" title="内容设置">
        <template #header-extra>
          <NButton @click="$router.push({ name: 'manage-questionBox' })" size="tiny" secondary> 回到控制台 </NButton>
        </template>
        <NFlex align="center">
          <NSelect
            v-model:value="useQB.displayTag"
            placeholder="选择当前话题"
            filterable
            clearable
            :options="useQB.tags.map((s) => ({ label: s.name, value: s.name }))"
            style="width: 200px"
          />
          <NButton @click="useQB.GetRecieveQAInfo" type="primary"> 刷新 </NButton>
          <NCheckbox v-model:checked="useQB.onlyFavorite"> 只显示收藏 </NCheckbox>
          <NCheckbox v-model:checked="useQB.onlyUnread"> 只显示未读 </NCheckbox>
        </NFlex>
      </NCard>
      <template v-if="useQB.displayQuestion">
        <NDivider style="margin: 10px 0 10px 0" />
        <NCard size="small" title="当前展示" embedded>
          <template #header-extra>
            <NFlex>
              <NButton @click="useQB.setCurrentQuestion(useQB.displayQuestion)" size="small" secondary type="info">
                取消展示
              </NButton>
              <NButton @click="useQB.read(useQB.displayQuestion, true)" size="small" secondary type="success">
                已读
              </NButton>
            </NFlex>
          </template>
          <QuestionItem :item="useQB.displayQuestion" />
        </NCard>
        <NDivider style="margin: 10px 0 10px 0" />
      </template>

      <NScrollbar :style="{ flex: 1, minWidth: '400px', overflow: 'auto' }">
        <QuestionItems :questions="useQB.recieveQuestionsFiltered">
          <template #footer="{ item }">
            <NFlex>
              <NTooltip>
                <template #trigger>
                  <NButton
                    @click="useQB.setCurrentQuestion(item)"
                    size="small"
                    :type="item.id != useQB.displayQuestion?.id ? 'default' : 'primary'"
                    :secondary="item.id != useQB.displayQuestion?.id"
                  >
                    <template #icon>
                      <NIcon
                        :component="
                          item.id != useQB.displayQuestion?.id ? ArrowCircleRight12Filled : ArrowCircleLeft12Filled
                        "
                      />
                    </template>
                  </NButton>
                </template>
                {{ item.id == useQB.displayQuestion?.id ? '取消' : '' }}设为当前展示的提问
              </NTooltip>
              <NButton v-if="!item.isReaded" size="small" @click="useQB.read(item, true)" type="success" secondary>
                设为已读
              </NButton>
              <NButton v-else size="small" @click="useQB.read(item, false)" type="warning" secondary
                >重设为未读</NButton
              >
              <NButton size="small" @click="useQB.favorite(item, !item.isFavorite)">
                <template #icon>
                  <NIcon
                    :component="item.isFavorite ? Heart : HeartOutline"
                    :color="item.isFavorite ? '#dd484f' : ''"
                  />
                </template>
                收藏
              </NButton>
            </NFlex>
          </template>
        </QuestionItems>
      </NScrollbar>
    </NFlex>
    <NCard style="min-height: 600px">
      <NFlex vertical :size="0" style="height: 100%">
        <NFlex align="center">
          <NButton @click="showSettingDrawer = true" type="primary"> 打开设置 </NButton>
          <NButton @click="showOBSModal = true" type="primary" secondary> 预览OBS组件 </NButton>
          <NCheckbox v-model:checked="showGreenBorder">
            显示边框
            <NTooltip>
              <template #trigger>
                <NIcon :component="Info24Filled" />
              </template>
              用于使用 OBS 直接捕获浏览器窗口时消除背景
            </NTooltip>
          </NCheckbox>
          <template v-if="useQB.displayQuestion">
            <NDivider vertical />
            <NButton @click="useQB.read(useQB.displayQuestion, true)" type="success"> 将当前问题设为已读 </NButton>
          </template>
        </NFlex>
        <NDivider style="margin-top: 10px">
          {{ cardSize.width.value.toFixed(0) }} x {{ cardSize.height.value.toFixed(0) }}
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            宽x高, 展示框右下角可以调整尺寸. 如果用的 OBS 组件的话尺寸不会同步到obs, 得你自己调
          </NTooltip>
        </NDivider>
        <NFlex justify="center" align="center" style="height: 100%">
          <div
            ref="cardRef"
            class="resize-box"
            :style="{
              border: showGreenBorder ? '24px solid green' : '',
              background: showGreenBorder ? 'green' : '',
              padding: '10px',
              width: savedCardSize.width + 'px',
              height: savedCardSize.height + 'px',
            }"
          >
            <QuestionDisplayCard :question="useQB.displayQuestion" :setting="setting" :css="customCss" />
          </div>
        </NFlex>
      </NFlex>
    </NCard>
  </NFlex>
  <NDrawer v-model:show="showSettingDrawer" :title="`设置`" :width="400" placement="left">
    <NDrawerContent title="设置" closable>
      <NFlex>
        <NTooltip>
          <template #trigger>
            <NRadioGroup v-model:value="setting.align" @update:value="updateSettings">
              <NRadioButton :value="QuestionDisplayAlign.Left">
                <NIcon :component="TextAlignLeft16Filled" />
              </NRadioButton>
              <NRadioButton :value="QuestionDisplayAlign.Center">
                <NIcon :component="TextAlignCenter16Filled" />
              </NRadioButton>
              <NRadioButton :value="QuestionDisplayAlign.Right">
                <NIcon :component="TextAlignRight16Filled" />
              </NRadioButton>
            </NRadioGroup>
          </template>
          文字对齐
        </NTooltip>
        <NFlex>
          <NCheckbox v-model:checked="setting.showImage" @update:checked="updateSettings"> 显示图片 </NCheckbox>
          <NCheckbox v-model:checked="setting.showUserName" @update:checked="updateSettings">
            显示投稿用户名
          </NCheckbox>
        </NFlex>
        <NCard size="small" title="内容设置">
          <NFlex>
            <NInputGroup style="max-width: 230px">
              <NInputGroupLabel>字体大小</NInputGroupLabel>
              <NInputNumber v-model:value="setting.fontSize" :min="1" :max="1000" />
              <NButton @click="updateSettings" type="info">保存</NButton>
            </NInputGroup>
            <NInputGroup style="max-width: 230px">
              <NInputGroupLabel>边框宽度</NInputGroupLabel>
              <NInputNumber v-model:value="setting.borderWidth" :min="1" :max="1000" />
              <NButton @click="updateSettings" type="info">保存</NButton>
            </NInputGroup>
            <NInputGroup style="max-width: 300px">
              <NInputGroupLabel>字重</NInputGroupLabel>
              <NInputNumber
                v-model:value="setting.fontWeight"
                :min="1"
                :max="10000"
                step="100"
                placeholder="只有部分字体支持"
              />
              <NButton @click="updateSettings" type="info">保存</NButton>
            </NInputGroup>
            <NFlex>
              <NSelect
                v-model:value="setting.font"
                :options="fontsOptions"
                filterable
                @update:value="updateSettings"
                placeholder="选择内容字体"
              />
              <NTooltip>
                <template #trigger>
                  <NButton @click="loadFonts" type="info" secondary> 获取字体列表 </NButton>
                </template>
                如果选用了本地字体且使用了obs组件的话请确保运行obs的电脑上也有这个字体
              </NTooltip>
            </NFlex>
            <NFlex justify="space-around" style="width: 100%">
              <NFlex style="min-width: 80px">
                字体颜色
                <NColorPicker
                  :value="setting.fontColor ? '#' + setting.fontColor : undefined"
                  show-preview
                  :modes="['hex']"
                  :actions="['clear', 'confirm']"
                  :show-alpha="false"
                  @update:value="
                    (c: string | null | undefined) => {
                      setting.fontColor = c?.replace('#', '')
                    }
                  "
                  @confirm="updateSettings"
                />
              </NFlex>
              <NFlex style="min-width: 80px">
                背景颜色
                <NColorPicker
                  :value="setting.backgroundColor ? '#' + setting.backgroundColor : undefined"
                  show-preview
                  :modes="['hex']"
                  :actions="['clear', 'confirm']"
                  :show-alpha="false"
                  @update:value="
                    (c: string | null | undefined) => {
                      setting.backgroundColor = c?.replace('#', '')
                    }
                  "
                  @confirm="updateSettings"
                />
              </NFlex>
              <NFlex style="min-width: 80px">
                边框颜色
                <NColorPicker
                  :value="setting.borderColor ? '#' + setting.borderColor : undefined"
                  show-preview
                  :modes="['hex']"
                  :actions="['clear', 'confirm']"
                  :show-alpha="false"
                  @update:value="
                    (c: string | null | undefined) => {
                      setting.borderColor = c?.replace('#', '')
                    }
                  "
                  @confirm="updateSettings"
                />
              </NFlex>
            </NFlex>
          </NFlex>
        </NCard>
        <NCard size="small" title="用户名设置">
          <NFlex>
            <NInputGroup style="max-width: 230px">
              <NInputGroupLabel>字体大小</NInputGroupLabel>
              <NInputNumber v-model:value="setting.nameFontSize" :min="1" :max="1000" />
              <NButton @click="updateSettings" type="info">保存</NButton>
            </NInputGroup>
            <NInputGroup style="max-width: 300px">
              <NInputGroupLabel>字重</NInputGroupLabel>
              <NInputNumber
                v-model:value="setting.nameFontWeight"
                :min="1"
                :max="10000"
                step="100"
                placeholder="只有部分字体支持"
              />
              <NButton @click="updateSettings" type="info">保存</NButton>
            </NInputGroup>
            <NFlex>
              <NSelect
                v-model:value="setting.nameFont"
                :options="fontsOptions"
                filterable
                @update:value="updateSettings"
                placeholder="选择用户名字体"
              />
              <NTooltip>
                <template #trigger>
                  <NButton @click="loadFonts" type="info" secondary> 获取字体列表 </NButton>
                </template>
                如果选用了本地字体且使用了obs组件的话请确保运行obs的电脑上也有这个字体
              </NTooltip>
            </NFlex>
            <NFlex style="min-width: 80px">
              字体颜色
              <NColorPicker
                :value="setting.nameFontColor ? '#' + setting.nameFontColor : undefined"
                show-preview
                :modes="['hex']"
                :actions="['clear', 'confirm']"
                :show-alpha="false"
                @update:value="
                  (c: string | null | undefined) => {
                    setting.nameFontColor = c?.replace('#', '')
                  }
                "
                @confirm="updateSettings"
              />
            </NFlex>
          </NFlex>
        </NCard>
        <NDivider style="margin: 10px 0 10px 0">
          自定义样式 (CSS)
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            只会在当前页面生效, 要想在OBS中也生效的话需要自己粘贴到创建浏览器源时的css栏中
          </NTooltip>
        </NDivider>
        <NInput type="textarea" v-model:value="customCss" placeholder="写上css" style="max-height: 500px" />
      </NFlex>
    </NDrawerContent>
  </NDrawer>
  <NModal
    preset="card"
    v-model:show="showOBSModal"
    closable
    style="max-width: 90vw; width: auto"
    title="OBS组件"
    content-style="display: flex; align-items: center; justify-content: center; flex-direction: column"
  >
    <div
      :style="{
        width: savedCardSize.width + 'px',
        height: savedCardSize.height + 'px',
      }"
    >
      <QuestionDisplayCard :question="useQB.displayQuestion" :setting="setting" />
    </div>
    <NDivider />
    <NInput readonly :value="'https://vtsuru.live/obs/question-display?token=' + accountInfo?.token" />
  </NModal>
</template>

<style>
.resize-box {
  display: flex;
  justify-content: center;
  overflow-y: visible;
  min-width: 300px;
  min-height: 100px;
  resize: both;
  overflow: auto;
  overflow-y: hidden;
  padding: 10px;
}
.n-drawer-mask {
  background-color: rgba(0, 0, 0, 0);
}
</style>
