import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getMyInfo, updateAvatar } from '~/composables/service/memberApi'
import type { MyInfoData } from '~/composables/service/memberApi'

const createEmptyMyInfo = (): MyInfoData => ({
  user_name: '',
  avatar: '',
  balances: [],
})

export const useMemberStore = defineStore('useMemberStore', () => {
  const info = ref<MyInfoData>(createEmptyMyInfo())
  const isFetching = ref(false)
  const fetched = ref(false)
  const selectedCurrencyID = ref(1)

  const fetchMyInfo = async (force = false): Promise<void> => {
    if (fetched.value && !force) return
    isFetching.value = true

    try {
      const response = await getMyInfo()
      const data = response?.data?.value

      if (data?.success) {
        info.value = data.data
        fetched.value = true
        selectedCurrencyID.value = data.data.balances[0]?.currency_id  || 1
        return
      }

      throw data ?? { message: 'Unknown error' }
    } catch (error: unknown) {
      if (error && typeof error === 'object') {
        if ('message' in error || 'error' in error) {
          throw error
        }
      }

      throw { message: 'Unknown error' }
    } finally {
      isFetching.value = false
    }
  }

  const changeAvatar = async (avatarPath: string): Promise<void> => {
    try {
      const response = await updateAvatar({ avatar: avatarPath })
      const data = response?.data?.value

      if (data?.success) {
        info.value.avatar = data.data.avatar
        return
      }

      throw data ?? { message: 'Unknown error' }
    } catch (error: unknown) {
      if (error && typeof error === 'object') {
        if ('message' in error || 'error' in error) {
          throw error
        }
      }

      throw { message: 'Unknown error' }
    }
  }

  // const setBalance = (amount: string, currency_id): void => {
  //   info.value.coin_amount = amount
  // }

    /**
   * Change the currently selected currency.
   */
  const setCurrency = (currencyID: number): void => {
    const exists = info.value.balances.some(
      (balance) => balance.currency_id === currencyID
    )

    if (!exists) return

    selectedCurrencyID.value = currencyID
  }

  /**
   * Update balance for a specific currency.
   */
  const setBalance = (
    amount: string,
    currencyID: number
  ): void => {
    const balance = info.value.balances.find(
      (item) => item.currency_id === currencyID
    )

    if (!balance) return

    balance.balance_amount = amount
  }


   // Get the balance for the currently selected currency
  const selectedBalance = computed(() => {
    return (
      info.value.balances.find(
        (balance) => balance.currency_id === selectedCurrencyID.value
      ) ?? null
    )
  })

  const reset = (): void => {
    info.value = createEmptyMyInfo()
    fetched.value = false
  }

  return {
    info,
    isFetching,
    fetched,
    fetchMyInfo,
    changeAvatar,
    selectedCurrencyID,
    setCurrency,
    setBalance,
    selectedBalance,
    // setCoins,
    reset,
  }
})