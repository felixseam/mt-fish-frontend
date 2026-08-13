import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useExperienceStore = defineStore('useExperienceStore', () => {
  const entered = ref(false)

  const enterExperience = (): void => {
    entered.value = true
  }

  const resetExperience = (): void => {
    entered.value = false
  }

  return {
    entered,
    enterExperience,
    resetExperience,
  }
})
