import { useAccount } from '@/api/account'
import { ConsumptionTypes, IDeductionSetting, UserConsumptionSetting } from '@/api/models/consumption'
import { QueryPostAPIWithParams } from '@/api/query'
import { ACCOUNT_API_URL } from '@/data/constants'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export const useConsumptionSettingStore = defineStore(
  'consumptionSetting',
  () => {
    const accountInfo = useAccount()
    const consumptionSetting = computed<UserConsumptionSetting>(() => {
      return accountInfo.value.consumptionSettings
    })
    const consumptionTypeMap = {
      [ConsumptionTypes.DanmakuStorage]: {
        name: '弹幕存储',
        key: 'danmakuStorage'
      }
    }

    async function UpdateConsumptionSetting(
      type: ConsumptionTypes,
      value: unknown
    ) {
      return await QueryPostAPIWithParams(
        ACCOUNT_API_URL + 'update-consumption-setting',
        {
          type: type
        },
        value
      )
    }
    function GetSetting(type: ConsumptionTypes) {
      // @ts-expect-error 直接从对象获取key
      return consumptionSetting.value[consumptionTypeMap[type].key] as IDeductionSetting
    }

    return { consumptionSetting, consumptionTypeMap, UpdateConsumptionSetting, GetSetting }
  }
)
