export enum ConsumptionTypes{
  DanmakuStorage,
}

export interface IDeductionSetting {
  isEnabled: boolean
 }
export interface UserConsumptionSetting {
  danmakuStorage: DanmakuStorageDeductionSetting
}
export enum DeductionStorageType {
  Time,
  Count
}
export interface DanmakuStorageDeductionSetting extends IDeductionSetting {
  storageType: DeductionStorageType
  isUnlimited: boolean
  limitDays: number
  limitCount: number
}
