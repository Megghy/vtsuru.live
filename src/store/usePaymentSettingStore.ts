import type { IDeductionSetting, UserConsumptionSetting } from '@/api/models/consumption'

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useAccount } from '@/api/account'
import { ConsumptionTypes } from '@/api/models/consumption'
import { QueryPostAPIWithParams } from '@/api/query'
import { ACCOUNT_API_URL } from '@/shared/config'

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
        key: 'danmakuStorage',
      },
    } as const satisfies Record<ConsumptionTypes, { name: string, key: keyof UserConsumptionSetting }>

    async function UpdateConsumptionSetting(
      type: ConsumptionTypes,
      value: unknown,
    ) {
      return QueryPostAPIWithParams(
        `${ACCOUNT_API_URL}update-consumption-setting`,
        {
          type,
        },
        value,
      )
    }
    function GetSetting(type: ConsumptionTypes) {
      const key = consumptionTypeMap[type].key
      return consumptionSetting.value[key] as IDeductionSetting
    }

    return { consumptionSetting, consumptionTypeMap, UpdateConsumptionSetting, GetSetting }
  },
)
