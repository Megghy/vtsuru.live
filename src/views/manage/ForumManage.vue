<script setup lang="ts">
import { useAccount } from '@/api/account'
import { QueryPostAPI } from '@/api/query'
import { useForumStore } from '@/store/useForumStore'
import {
  DataTableColumns,
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NFlex,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NModal,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NTime,
  useMessage,
} from 'naive-ui'
import { h, ref } from 'vue'
import { ForumModel, ForumUserModel } from '@/api/models/forum'
import { FORUM_API_URL } from '@/data/constants'
// @ts-ignore
import Agreement from '@/document/EnableForumAgreement.md'
import { UserBasicInfo } from '@/api/api-models'

const useForum = useForumStore()
const accountInfo = useAccount()
const message = useMessage()

const managedForums = ref((await useForum.GetManagedForums()) ?? [])
const currentForum = ref((await useForum.GetForumInfo(accountInfo.value.id)) ?? ({} as ForumModel))
const selectedForum = ref(accountInfo.value.id)

const readedAgreement = ref(false)
const showAgreement = ref(false)
const create_Name = ref('')
const create_Description = ref('')

const showAddAdminModal = ref(false)
const inputUser = ref<UserBasicInfo>({} as UserBasicInfo)
const addAdminName = ref()

const paginationSetting = { defaultPageSize: 20, showSizePicker: true, pageSizes: [20, 50, 100] }

async function createForum() {
  if (!readedAgreement.value) {
    message.warning('请先阅读并同意服务协议')
    return
  }
  if (!create_Name.value) {
    message.warning('请输入名称')
    return
  }
  try {
    const data = await QueryPostAPI<ForumModel>(FORUM_API_URL + 'create', {
      name: create_Name.value,
    })
    if (data.code == 200) {
      message.success('创建成功')
      currentForum.value = data.data
    } else {
      message.error('创建失败:' + data.message)
      console.error(data.message)
    }
  } catch (err) {
    console.error(err)
    message.error('创建失败:' + err)
  }
}
async function SwitchForum(owner: number) {
  currentForum.value = (await useForum.GetForumInfo(owner)) ?? ({} as ForumModel)
}
const defaultColumns: DataTableColumns<ForumUserModel> = [
  {
    title: '名称',
    key: 'name',
  },
  {
    title: 'B站账号',
    key: 'biliId',
    render(row) {
      return h(NTag, { type: row.isBiliAuthed ? 'success' : 'warning' }, () => (row.isBiliAuthed ? '已绑定' : '未绑定'))
    },
  },
]
const applyingColumns: DataTableColumns<ForumUserModel> = [
  ...defaultColumns,
  {
    title: '操作',
    key: 'action',
    render(row) {
      return h(
        NButton,
        {
          text: true,
          type: 'success',
          onClick: () =>
            useForum.ConfirmApply(currentForum.value.owner.id, row.id).then((success) => {
              if (success) message.success('操作成功')
              currentForum.value.applying = currentForum.value.applying.filter((u) => u.id != row.id)
            }),
        },
        { default: () => '通过申请' },
      )
    },
  },
]
const memberColumns: DataTableColumns<ForumUserModel> = [
  ...defaultColumns,
  {
    title: '操作',
    key: 'action',
    render(row) {
      return h(
        NButton,
        {
          text: true,
          type: 'success',
          onClick: () =>
            useForum.ConfirmApply(currentForum.value.owner.id, row.id).then((success) => {
              if (success) message.success('操作成功')
              currentForum.value.applying = currentForum.value.applying.filter((u) => u.id != row.id)
            }),
        },
        { default: () => '通过申请' },
      )
    },
  },
]
const banColumns: DataTableColumns<ForumUserModel> = [
  ...defaultColumns,
  {
    title: '操作',
    key: 'action',
    render(row) {
      return h(
        NButton,
        {
          text: true,
          type: 'success',
          onClick: () =>
            useForum.ConfirmApply(currentForum.value.owner.id, row.id).then((success) => {
              if (success) message.success('操作成功')
              currentForum.value.applying = currentForum.value.applying.filter((u) => u.id != row.id)
            }),
        },
        { default: () => '通过申请' },
      )
    },
  },
]

const adminColumns: DataTableColumns<ForumUserModel> = [
  ...defaultColumns,
  {
    title: '操作',
    key: 'action',
    render(row) {
      return h(
        NButton,
        {
          text: true,
          type: 'success',
          onClick: () =>
            useForum.ConfirmApply(currentForum.value.owner.id, row.id).then((success) => {
              if (success) message.success('操作成功')
              currentForum.value.applying = currentForum.value.applying.filter((u) => u.id != row.id)
            }),
        },
        { default: () => '通过申请' },
      )
    },
  },
]

async function addAdmin() {
  if (!currentForum.value.id) return
  try {
    const data = await QueryPostAPI<ForumModel>(FORUM_API_URL + 'manage/add-admin', {
      forum: currentForum.value.id,
      user: addAdminName.value,
    })
    if (data.code == 200) {
      message.success('操作成功')
    } else {
      message.error('操作失败: ' + data.message)
    }
  } catch (err) {
    message.error('操作失败: ' + err)
  }
}
</script>

<template>
  <NCard v-if="!currentForum.name" size="small" title="啊哦">
    <NAlert type="error"> 你尚未创建粉丝讨论区 </NAlert>
    <NDivider />
    <NFlex justify="center">
      <NFlex vertical>
        <NButton @click="createForum" size="large" type="primary"> 创建粉丝讨论区 </NButton>
        <NInputGroup>
          <NInputGroupLabel> 名称 </NInputGroupLabel>
          <NInput v-model:value="create_Name" placeholder="就是名称" maxlength="20" minlength="1" show-count />
        </NInputGroup>

        <NInput
          v-model:value="create_Description"
          placeholder="(可选) 公告/描述"
          maxlength="200"
          show-count
          type="textarea"
        />
        <NCheckbox v-model:checked="readedAgreement">
          已阅读并同意 <NButton @click="showAgreement = true" text type="info"> 服务协议 </NButton>
        </NCheckbox>
      </NFlex>
    </NFlex>
  </NCard>
  <template v-else>
    <NSpin :show="useForum.isLoading">
      <NSelect
        v-model:value="selectedForum"
        :options="
          managedForums.map((f) => ({
            label: (f.owner.id == accountInfo.id ? '[我的] ' : '') + f.name + ` (${f.owner.name})`,
            value: f.owner.id,
          }))
        "
        @update:value="(v) => SwitchForum(v)"
      >
        <template #header>
          <NButton @click="SwitchForum(accountInfo.id)" size="small" type="primary"> 我的粉丝讨论区 </NButton>
        </template>
      </NSelect>
      <NDivider />
      <NTabs animated v-bind:key="selectedForum" type="segment">
        <NTabPane tab="信息" name="info">
          <NDescriptions bordered size="small">
            <NDescriptionsItem label="名称"> {{ currentForum.name }} </NDescriptionsItem>
            <NDescriptionsItem label="公告"> {{ currentForum.description ?? '无' }} </NDescriptionsItem>
            <NDescriptionsItem label="创建者"> {{ currentForum.owner.name }} </NDescriptionsItem>
            <NDescriptionsItem label="创建时间"> <NTime :time="currentForum.createAt" /> </NDescriptionsItem>
            <NDescriptionsItem label="帖子数量"> {{ currentForum.topicCount }} </NDescriptionsItem>
            <NDescriptionsItem v-if="currentForum.settings.requireApply" label="成员数量">
              {{ currentForum.members?.length ?? 0 }}
            </NDescriptionsItem>
            <NDescriptionsItem label="管理员数量"> {{ currentForum.admins?.length ?? 0 }} </NDescriptionsItem>
          </NDescriptions>
          <NDivider> 设置 </NDivider>
        </NTabPane>
        <NTabPane tab="成员" name="member">
          <NDivider> 申请 </NDivider>
          <NDataTable :columns="applyingColumns" :data="currentForum.applying" :pagination="paginationSetting" />
          <NDivider> 管理员 </NDivider>
          <NFlex>
            <NButton @click="showAddAdminModal = true" size="small" type="primary"> 添加管理员 </NButton>
          </NFlex>
          <NDataTable :columns="adminColumns" :data="currentForum.admins" :pagination="paginationSetting" />
          <template v-if="currentForum.settings.requireApply">
            <NDivider> 成员 </NDivider>
            <NDataTable
              :columns="memberColumns"
              :data="currentForum.members.sort((a, b) => (a.isAdmin ? 1 : 0) - (b.isAdmin ? 1 : 0))"
              :pagination="paginationSetting"
            />
          </template>
          <NDivider> 封禁用户 </NDivider>
          <NDataTable :columns="banColumns" :data="currentForum.blackList" :pagination="paginationSetting" />
        </NTabPane>
      </NTabs>
    </NSpin>
  </template>
  <NModal
    v-model:show="showAgreement"
    preset="card"
    title="开通粉丝讨论区用户协议"
    style="width: 600px; max-width: 90vw"
  >
    <Agreement />
  </NModal>
  <NModal v-model:show="showAddAdminModal" preset="card" title="添加管理员" style="width: 600px; max-width: 90vw">
    <NInput v-model:value="addAdminName" placeholder="请输入用户名或VTsuruId" />
    <NButton @click="addAdmin" type="primary"> 添加 </NButton>
  </NModal>
</template>
