import { QueryDeleteAPI, QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { getCurrentAPIUrl } from '@/shared/config'

export interface ObsSceneProjectSummary {
  id: number
  name: string
  shareKey: string
  publishedVersion: number
  activeSceneId?: string | null
  hasPublished: boolean
  createTime: number
  updateTime: number
  publishTime?: number | null
}

export interface ObsSceneProjectDetail extends ObsSceneProjectSummary {
  ownerUserId: number
  draftJson: string
  publishedJson?: string | null
  publishedHash?: string | null
}

export interface ObsPublicSceneSnapshot {
  ownerUserId: number
  name: string
  publishedVersion: number
  publishedHash: string
  activeSceneId?: string | null
  changed: boolean
  data?: string | null
  publishedAt: number
}

export interface ObsSwitchSceneResult {
  matched: boolean
  activeSceneId?: string | null
  publishedVersion: number
}

export interface UploadedObsSceneAsset {
  url: string
  width: number
  height: number
  size: number
}

function sceneApi(path: string) {
  return new URL(`/api/obs-scene/${path}`, getCurrentAPIUrl()).toString()
}

export async function listObsSceneProjects(): Promise<ObsSceneProjectSummary[]> {
  const resp = await QueryGetAPI<ObsSceneProjectSummary[]>(sceneApi('list'))
  return unwrapOk(resp, '获取 OBS 场景列表失败')
}

export async function createObsSceneProject(payload?: {
  name?: string
  draftJson?: string
}): Promise<ObsSceneProjectDetail> {
  const resp = await QueryPostAPI<ObsSceneProjectDetail>(sceneApi('create'), payload ?? {})
  return unwrapOk(resp, '创建 OBS 场景项目失败')
}

export async function getObsSceneProject(id: number): Promise<ObsSceneProjectDetail> {
  const resp = await QueryGetAPI<ObsSceneProjectDetail>(sceneApi(`${id}`))
  return unwrapOk(resp, '加载 OBS 场景项目失败')
}

export async function saveObsSceneDraft(
  id: number,
  payload: { name?: string; draftJson: string },
): Promise<ObsSceneProjectDetail> {
  const resp = await QueryPostAPI<ObsSceneProjectDetail>(sceneApi(`${id}/draft`), payload)
  return unwrapOk(resp, '保存场景草稿失败')
}

export async function publishObsSceneProject(
  id: number,
  payload?: { name?: string; draftJson?: string },
): Promise<ObsSceneProjectDetail> {
  const resp = await QueryPostAPI<ObsSceneProjectDetail>(sceneApi(`${id}/publish`), payload ?? {})
  return unwrapOk(resp, '发布 OBS 场景失败')
}

export async function switchObsActiveScene(
  id: number,
  payload: { sceneId?: string; obsSceneName?: string },
): Promise<ObsSwitchSceneResult> {
  const resp = await QueryPostAPI<ObsSwitchSceneResult>(sceneApi(`${id}/switch-scene`), payload)
  return unwrapOk(resp, '切换 OBS 场景失败')
}

export async function rotateObsSceneShareKey(id: number): Promise<ObsSceneProjectSummary> {
  const resp = await QueryPostAPI<ObsSceneProjectSummary>(sceneApi(`${id}/rotate-key`), {})
  return unwrapOk(resp, '重置场景链接失败')
}

export async function deleteObsSceneProject(id: number): Promise<void> {
  const resp = await QueryDeleteAPI<null>(sceneApi(`${id}`))
  unwrapOk(resp, '删除场景项目失败')
}

export async function getPublicObsScene(shareKey: string, hash?: string): Promise<ObsPublicSceneSnapshot> {
  const resp = await QueryGetAPI<ObsPublicSceneSnapshot>(
    sceneApi(`public/${encodeURIComponent(shareKey)}`),
    hash ? { hash } : undefined,
  )
  return unwrapOk(resp, '加载公开 OBS 场景失败')
}

export async function uploadObsSceneAsset(file: File): Promise<UploadedObsSceneAsset> {
  const form = new FormData()
  form.append('file', file)
  const resp = await QueryPostAPI<UploadedObsSceneAsset>(sceneApi('assets/upload'), form, undefined, '')
  return unwrapOk(resp, '上传图片素材失败')
}
