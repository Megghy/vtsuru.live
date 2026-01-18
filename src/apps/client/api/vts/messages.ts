export const VTS_API_NAME = 'VTubeStudioPublicAPI'
export const VTS_API_VERSION = '1.0'

export type VtsRequestMessageType =
  | 'APIStateRequest'
  | 'AuthenticationTokenRequest'
  | 'AuthenticationRequest'
  | 'StatisticsRequest'
  | 'FaceFoundRequest'
  | 'EventSubscriptionRequest'
  | 'HotkeysInCurrentModelRequest'
  | 'HotkeyTriggerRequest'
  | 'MoveModelRequest'
  | 'InjectParameterDataRequest'
  | 'ItemListRequest'
  | 'ItemLoadRequest'
  | 'ItemMoveRequest'
  | 'ItemAnimationControlRequest'
  | 'ItemPinRequest'
  | 'ItemUnloadRequest'

export type VtsResponseMessageType =
  | 'APIStateResponse'
  | 'AuthenticationTokenResponse'
  | 'AuthenticationResponse'
  | 'StatisticsResponse'
  | 'FaceFoundResponse'
  | 'EventSubscriptionResponse'
  | 'HotkeysInCurrentModelResponse'
  | 'HotkeyTriggerResponse'
  | 'MoveModelResponse'
  | 'InjectParameterDataResponse'
  | 'ItemListResponse'
  | 'ItemLoadResponse'
  | 'ItemMoveResponse'
  | 'ItemAnimationControlResponse'
  | 'ItemPinResponse'
  | 'ItemUnloadResponse'
  | 'APIError'

export interface VtsBaseMessage {
  apiName: string
  apiVersion: string
  messageType: string
}

export interface VtsBaseRequest<TMessageType extends VtsRequestMessageType, TData = unknown> extends VtsBaseMessage {
  requestID: string
  messageType: TMessageType
  data?: TData
}

export interface VtsBaseResponse<TMessageType extends string = string, TData = unknown> extends VtsBaseMessage {
  timestamp?: number
  requestID?: string
  messageType: TMessageType
  data?: TData
}

export interface VtsApiStateResponseData {
  active: boolean
  vTubeStudioVersion: string
  currentSessionAuthenticated: boolean
}

export interface VtsAuthenticationTokenRequestData {
  pluginName: string
  pluginDeveloper: string
  pluginIcon?: string
}

export interface VtsAuthenticationTokenResponseData {
  authenticationToken: string
}

export interface VtsAuthenticationRequestData {
  pluginName: string
  pluginDeveloper: string
  authenticationToken: string
}

export interface VtsStatisticsResponseData {
  uptime: number
  framerate: number
  vTubeStudioVersion: string
  allowedPlugins: number
  connectedPlugins: number
  startedWithSteam: boolean
  windowWidth: number
  windowHeight: number
  windowIsFullscreen: boolean
}

export interface VtsFaceFoundResponseData {
  found: boolean
}

export interface VtsEventSubscriptionRequestData {
  eventName: string
  subscribe: boolean
  config?: Record<string, unknown>
}

export interface VtsEventSubscriptionResponseData {
  subscribedEventCount: number
  subscribedEvents: string[]
}

export interface VtsTrackingStatusChangedEventData {
  faceFound: boolean
  leftHandFound: boolean
  rightHandFound: boolean
}

export interface VtsModelLoadedEventData {
  modelLoaded: boolean
  modelName: string
  modelID: string
}

export interface VtsModelMovedEventData {
  modelID: string
  modelName: string
  modelPosition: {
    positionX: number
    positionY: number
    size: number
    rotation: number
  }
}

export interface VtsItemEventData {
  itemEventType: string
  itemInstanceID: string
  itemFileName: string
  itemPosition?: { x: number, y: number }
}

export interface VtsHotkeysInCurrentModelRequestData {
  modelID?: string
  live2DItemFileName?: string
}

export interface VtsHotkeyInfo {
  name: string
  type: string
  description: string
  file: string
  hotkeyID: string
  keyCombination: string[]
  onScreenButtonID: number
}

export interface VtsHotkeysInCurrentModelResponseData {
  modelLoaded: boolean
  modelName: string
  modelID: string
  availableHotkeys: VtsHotkeyInfo[]
}

export interface VtsHotkeyTriggerRequestData {
  hotkeyID: string
  itemInstanceID?: string
}

export interface VtsMoveModelRequestData {
  timeInSeconds: number
  valuesAreRelativeToModel?: boolean
  positionX?: number
  positionY?: number
  rotation?: number
  size?: number
}

export type VtsInjectMode = 'set' | 'add'

export interface VtsInjectedParameterValue {
  id: string
  value: number
  weight?: number
}

export interface VtsInjectParameterDataRequestData {
  faceFound?: boolean
  mode: VtsInjectMode
  parameterValues: VtsInjectedParameterValue[]
}

export interface VtsItemListRequestData {
  includeAvailableSpots?: boolean
  includeItemInstancesInScene?: boolean
  includeAvailableItemFiles?: boolean
  onlyItemsWithFileName?: string
  onlyItemsWithInstanceID?: string
}

export type VtsItemType = 'PNG' | 'JPG' | 'GIF' | 'AnimationFolder' | 'Live2D' | 'Unknown'

export interface VtsItemInstance {
  fileName: string
  instanceID: string
  order: number
  type: VtsItemType
  censored: boolean
  flipped: boolean
  locked: boolean
  smoothing: number
  framerate?: number
  frameCount?: number
  currentFrame?: number
  pinnedToModel: boolean
  pinnedModelID?: string
  pinnedArtMeshID?: string
  groupName?: string
  sceneName?: string
  fromWorkshop?: boolean
}

export interface VtsAvailableItemFile {
  fileName: string
  type: VtsItemType
  loadedCount: number
}

export interface VtsItemListResponseData {
  itemsInSceneCount: number
  totalItemsAllowedCount: number
  canLoadItemsRightNow: boolean
  availableSpots?: number[]
  itemInstancesInScene?: VtsItemInstance[]
  availableItemFiles?: VtsAvailableItemFile[]
}

export interface VtsItemLoadRequestData {
  fileName: string
  positionX?: number
  positionY?: number
  size?: number
  rotation?: number
  fadeTime?: number
  order?: number
  failIfOrderTaken?: boolean
  smoothing?: number
  censored?: boolean
  flipped?: boolean
  locked?: boolean
  unloadWhenPluginDisconnects?: boolean
}

export interface VtsItemLoadResponseData {
  instanceID: string
  fileName: string
}

export interface VtsItemMoveRequestData {
  itemsToMove: Array<{
    itemInstanceID: string
    timeInSeconds: number
    fadeMode?: string
    positionX?: number
    positionY?: number
    size?: number
    rotation?: number
    order?: number
    setFlip?: boolean
    flip?: boolean
    userCanStop?: boolean
  }>
}

export interface VtsItemAnimationControlRequestData {
  itemInstanceID: string
  framerate?: number
  frame?: number
  brightness?: number
  opacity?: number
  setAutoStopFrames?: boolean
  autoStopFrames?: number[]
  setAnimationPlayState?: boolean
  animationPlayState?: boolean
}

export interface VtsItemPinRequestData {
  pin: boolean
  itemInstanceID: string
  angleRelativeTo?: string
  sizeRelativeTo?: string
  vertexPinType?: string
  pinInfo?: unknown
}

export interface VtsItemUnloadRequestData {
  unloadAllInScene?: boolean
  unloadAllLoadedByThisPlugin?: boolean
  allowUnloadingItemsLoadedByUserOrOtherPlugins?: boolean
  instanceIDs?: string[]
  fileNames?: string[]
}

export interface VtsItemUnloadResponseData {
  unloadedItems: Array<{ instanceID: string, fileName: string }>
}

export interface VtsApiErrorData {
  errorID?: string
  message?: string
  data?: unknown
}
