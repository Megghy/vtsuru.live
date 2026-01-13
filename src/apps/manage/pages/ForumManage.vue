<script setup lang="ts">
import type {
  DataTableColumns,
} from 'naive-ui'
import type { UserBasicInfo } from '@/api/api-models'
import type { ForumModel, ForumUserModel } from '@/api/models/forum'
import {
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
import { h, onMounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { ForumUserLevels } from '@/api/models/forum'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import UserBasicInfoCard from '@/apps/manage/components/UserBasicInfoCard.vue'
import { FORUM_API_URL } from '@/shared/config'
// @ts-ignore
import Agreement from '@/content/agreements/EnableForumAgreement.md'
import { useForumStore } from '@/store/useForumStore'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'

const useForum = useForumStore()
const accountInfo = useAccount()
const message = useMessage()

const managedForums = ref((await useForum.GetManagedForums()) ?? [])
const currentForum = ref((await useForum.GetForumInfo(accountInfo.value.id)) ?? ({} as ForumModel))
const selectedForum = ref()

const readedAgreement = ref(false)
const showAgreement = ref(false)
const create_Name = ref('')
const create_Description = ref('')

const showAddAdminModal = ref(false)
const addAdminName = ref()
const currentAdminInfo = ref<UserBasicInfo>()

const showBanModal = ref(false)
const addBanName = ref()
const currentBanUserInfo = ref<UserBasicInfo>()

const paginationSetting = { defaultPageSize: 20, showSizePicker: true, pageSizes: [20, 50, 100] }

const levels = [
  {
    label: '1. 所有人',
    value: ForumUserLevels.Guest,
  },
  {
    label: '2. 已注册用户',
    value: ForumUserLevels.User,
  },
  {
    label: '3. 已加入的用户',
    value: ForumUserLevels.Member,
  },
  {
    label: '4. 加入并绑定B站的用户',
    value: ForumUserLevels.AuthedMember,
  },
  {
    label: '5. 仅管理员',
    value: ForumUserLevels.Admin,
  },
]

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
    const data = await QueryPostAPI<ForumModel>(`${FORUM_API_URL}create`, {
      name: create_Name.value,
    })
    if (data.code == 200) {
      message.success('创建成功')
      currentForum.value = data.data
    } else {
      message.error(`创建失败:${data.message}`)
      console.error(data.message)
    }
  } catch (err) {
    console.error(err)
    message.error(`创建失败:${err}`)
  }
}
async function SwitchForum(owner: number) {
  selectedForum.value = owner
  currentForum.value = (await useForum.GetForumInfo(owner)) ?? ({} as ForumModel)
}
async function refreshForumInfo() {
  currentForum.value = (await useForum.GetForumInfo(currentForum.value.owner.id)) ?? ({} as ForumModel)
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
              currentForum.value.applying = currentForum.value.applying.filter(u => u.id != row.id)
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
      return h(NFlex, {}, () => [
        h(
          NButton,
          {
            text: true,
            type: 'error',
            onClick: () => {
              banUser(row.id)
            },
          },
          { default: () => '封禁' },
        ),
        currentForum.value.owner.id == accountInfo.value.id
          ? h(
              NButton,
              {
                text: true,
                type: 'success',
                onClick: () => {
                  addAdmin(row.id)
                },
              },
              { default: () => '设为管理员' },
            )
          : null,
      ])
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
          onClick: () => unbanUser(row.id),
        },
        { default: () => '解禁' },
      )
    },
  },
]

const adminColumns: DataTableColumns<ForumUserModel> = [
  ...defaultColumns,
  {
    title: '操作',
    key: 'action',
    disabled: () => currentForum.value.owner.id != accountInfo.value.id,
    render(row) {
      return currentForum.value.owner.id == accountInfo.value.id
        ? h(
            NButton,
            {
              text: true,
              type: 'error',
              onClick: () => {
                removeAdmin(row.id)
              },
            },
            { default: () => ' 取消管理员' },
          )
        : null
    },
  },
]

async function addAdmin(id: number) {
  try {
    const data = await QueryGetAPI<ForumModel>(`${FORUM_API_URL}manage/add-admin`, {
      forum: currentForum.value.owner.id,
      id,
    })
    if (data.code == 200) {
      message.success('已设置为管理员')
      refreshForumInfo()
      addAdminName.value = ''
      showAddAdminModal.value = false
    } else {
      message.error(`操作失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`操作失败: ${err}`)
  }
}
async function removeAdmin(id: number) {
  try {
    const data = await QueryGetAPI<ForumModel>(`${FORUM_API_URL}manage/del-admin`, {
      forum: currentForum.value.owner.id,
      id,
    })
    if (data.code == 200) {
      message.success('已取消管理员权限')
      refreshForumInfo()
    } else {
      message.error(`操作失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`操作失败: ${err}`)
  }
}
async function banUser(id: number) {
  try {
    const data = await QueryGetAPI<ForumModel>(`${FORUM_API_URL}manage/ban`, {
      forum: currentForum.value.owner.id,
      id,
    })
    if (data.code == 200) {
      message.success('已封禁用户')
      refreshForumInfo()
    } else {
      message.error(`操作失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`操作失败: ${err}`)
  }
}
async function unbanUser(id: number) {
  try {
    const data = await QueryGetAPI<ForumModel>(`${FORUM_API_URL}manage/unban`, {
      forum: currentForum.value.owner.id,
      id,
    })
    if (data.code == 200) {
      message.success('已解禁')
      refreshForumInfo()
    } else {
      message.error(`操作失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`操作失败: ${err}`)
  }
}
async function updateForumSettings() {
  try {
    const data = await QueryPostAPI(`${FORUM_API_URL}manage/update-setting`, currentForum.value.settings)
    if (data.code == 200) {
      message.success('修改成功')
      refreshForumInfo()
    } else {
      message.error(`修改失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`修改失败: ${err}`)
  }
}

onMounted(() => {
  if (currentForum.value.name) {
    selectedForum.value = currentForum.value.owner.id
  }
})
</script>

<template>
  <div class="forum-manage-view">
    <ManagePageHeader title="粉丝讨论区" subtitle="创建与管理讨论区">
      <template #action>
        <NButton secondary size="small" :loading="useForum.isLoading" @click="refreshForumInfo">
          刷新
        </NButton>
      </template>
    </ManagePageHeader>

    <template v-if="!currentForum.name && managedForums.length > 0">
      <NAlert type="info" :bordered="false">
        你是某些讨论区的管理员, 可以在下方选择需要管理的讨论区
      </NAlert>
    </template>
    <NSelect
      v-model:value="selectedForum"
      :options="
        managedForums.map((f) => ({
          label: `${(f.owner.id === accountInfo.id ? '[我的] ' : '') + f.name} (${f.owner.name})`,
          value: f.owner.id,
        }))
      "
      placeholder="选择要管理的粉丝讨论区"
      :fallback-option="(v) => ({ label: '尚未创建', value: v })"
      @update:value="(v) => SwitchForum(v)"
    >
      <template #header>
        <NButton
          size="small"
          type="primary"
          @click="SwitchForum(accountInfo.id)"
        >
          我的粉丝讨论区
        </NButton>
      </template>
    </NSelect>
    <NDivider />
    <NCard
      v-if="!currentForum.name"
      size="small"
      title="啊哦"
    >
      <NAlert type="error">
        你尚未创建粉丝讨论区
      </NAlert>
      <NDivider />
      <NFlex justify="center">
        <NFlex vertical>
          <NButton
            size="large"
            type="primary"
            @click="createForum"
          >
            创建粉丝讨论区
          </NButton>
          <NInputGroup>
            <NInputGroupLabel> 名称 </NInputGroupLabel>
            <NInput
              v-model:value="create_Name"
              placeholder="就是名称"
              maxlength="20"
              minlength="1"
              show-count
            />
          </NInputGroup>

          <NInput
            v-model:value="create_Description"
            placeholder="(可选) 公告/描述"
            maxlength="200"
            show-count
            type="textarea"
          />
          <NCheckbox v-model:checked="readedAgreement">
            已阅读并同意 <NButton
              text
              type="info"
              @click="showAgreement = true"
            >
              服务协议
            </NButton>
          </NCheckbox>
        </NFlex>
      </NFlex>
    </NCard>
    <template v-else-if="currentForum">
      <NSpin :show="useForum.isLoading">
        <NTabs
          :key="selectedForum"
          animated
          type="segment"
        >
          <NTabPane
            tab="信息"
            name="info"
          >
            <NDescriptions
              bordered
              size="small"
            >
              <NDescriptionsItem label="名称">
                {{ currentForum.name }}
              </NDescriptionsItem>
              <NDescriptionsItem label="公告">
                {{ currentForum.description ?? '无' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="创建者">
                {{ currentForum.owner.name }}
              </NDescriptionsItem>
              <NDescriptionsItem label="创建时间">
                <NTime :time="currentForum.createAt" />
              </NDescriptionsItem>
              <NDescriptionsItem label="帖子数量">
                {{ currentForum.topicCount }}
              </NDescriptionsItem>
              <NDescriptionsItem
                v-if="currentForum.settings.requireApply"
                label="成员数量"
              >
                {{ currentForum.members?.length ?? 0 }}
              </NDescriptionsItem>
              <NDescriptionsItem label="管理员数量">
                {{ currentForum.admins?.length ?? 0 }}
              </NDescriptionsItem>
            </NDescriptions>
            <NDivider> 设置 </NDivider>
            <NDescriptions
              class="setting"
              label-placement="left"
            >
              <NDescriptionsItem label="加入需要进行管理员同意">
                <NCheckbox
                  v-model:checked="currentForum.settings.requireApply"
                  @update:checked="updateForumSettings"
                />
              </NDescriptionsItem>
              <NDescriptionsItem
                v-if="currentForum.settings.requireApply"
                label="仅允许已绑定账号的用户申请"
              >
                <NCheckbox
                  v-model:checked="currentForum.settings.requireAuthedToJoin"
                  @update:checked="updateForumSettings"
                />
              </NDescriptionsItem>
              <NDescriptionsItem label="允许发布帖子">
                <NCheckbox
                  v-model:checked="currentForum.settings.allowPost"
                  @update:checked="updateForumSettings"
                />
              </NDescriptionsItem>
              <NDescriptionsItem label="允许谁查看讨论区">
                <NSelect
                  v-model:value="currentForum.settings.allowedViewerLevel"
                  :options="levels"
                  style="min-width: 200px"
                  @update:value="updateForumSettings"
                />
              </NDescriptionsItem>
              <NDescriptionsItem label="允许谁发布帖子">
                <NSelect
                  v-model:value="currentForum.settings.allowedPostLevel"
                  :options="levels"
                  style="min-width: 200px"
                  @update:value="updateForumSettings"
                />
              </NDescriptionsItem>
            </NDescriptions>
          </NTabPane>
          <NTabPane
            tab="成员"
            name="member"
          >
            <NDivider> 申请加入 </NDivider>
            <NDataTable
              :columns="applyingColumns"
              :data="currentForum.applying"
              :pagination="paginationSetting"
            />
            <NDivider> 成员 </NDivider>
            <NDataTable
              :columns="memberColumns"
              :data="currentForum.members.sort((a, b) => (a.isAdmin ? 1 : 0) - (b.isAdmin ? 1 : 0))"
              :pagination="paginationSetting"
            />
            <NDivider> 管理员 </NDivider>
            <NFlex>
              <NButton
                size="small"
                type="primary"
                :disabled="currentForum.owner.id !== accountInfo.id"
                @click="showAddAdminModal = true"
              >
                添加管理员
              </NButton>
            </NFlex>
            <br>
            <NDataTable
              :columns="adminColumns"
              :data="currentForum.admins"
              :pagination="paginationSetting"
            />
            <NDivider> 封禁用户 </NDivider>
            <NFlex>
              <NButton
                size="small"
                type="primary"
                @click="showBanModal = true"
              >
                封禁用户
              </NButton>
            </NFlex>
            <br>
            <NDataTable
              :columns="banColumns"
              :data="currentForum.blackList"
              :pagination="paginationSetting"
            />
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
    <NModal
      v-model:show="showAddAdminModal"
      preset="card"
      title="添加管理员"
      style="width: 600px; max-width: 90vw"
    >
      <UserBasicInfoCard
        :user="addAdminName"
        @update:user-info="(v) => (currentAdminInfo = v)"
      />
      <br>
      <NInput
        v-model:value="addAdminName"
        placeholder="请输入用户名或VTsuruId"
      />
      <NDivider />
      <NButton
        type="primary"
        :disabled="!currentAdminInfo?.id"
        @click="addAdmin(currentAdminInfo!.id)"
      >
        添加
      </NButton>
    </NModal>

    <NModal
      v-model:show="showBanModal"
      preset="card"
      title="封禁用户"
      style="width: 600px; max-width: 90vw"
    >
      <UserBasicInfoCard
        :user="addBanName"
        @update:user-info="(v) => (currentBanUserInfo = v)"
      />
      <br>
      <NInput
        v-model:value="addBanName"
        placeholder="请输入用户名或VTsuruId"
      />
      <NDivider />
      <NButton
        type="warning"
        :disabled="!currentBanUserInfo?.id"
        @click="banUser(currentBanUserInfo!.id)"
      >
        封禁
      </NButton>
    </NModal>
  </div>
</template>

<style>
.forum-manage-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting .n-descriptions-table-content {
  display: flex !important;
  align-items: center !important;
}
</style>
