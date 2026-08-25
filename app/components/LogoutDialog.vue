<template>
  <OceanCardDialogShell
    v-model="dialogVisible"
    :title="t('logout.title')"
    icon="mdi-logout"
    icon-color="#fac775"
    icon-bg="rgba(186, 117, 23, 0.18)"
    icon-border="rgba(186, 117, 23, 0.38)"
    max-width="420"
    :persistent="true"
  >
    <v-card-text class="pa-5">
      <p class="logout-subtitle">
        {{ t('logout.message') }}
      </p>
    </v-card-text>

    <v-card-actions class="px-5 pb-5 pt-0 gap-3">
      <v-btn
        variant="outlined"
        color="rgba(173,228,242,0.4)"
        class="logout-btn-cancel flex-grow-1"
        @click="dialogVisible = false"
      >
        {{ t('common.cancel') }}
      </v-btn>
      <v-btn
        variant="flat"
        class="logout-btn-confirm flex-grow-1"
        @click="confirm"
      >
        <v-icon start size="16">mdi-logout</v-icon>
        {{ t('logout.action') }}
      </v-btn>
    </v-card-actions>
  </OceanCardDialogShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import OceanCardDialogShell from "~/components/common/OceanCardDialogShell.vue";

const { t } = useFrontendI18n()
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function confirm() {
  emit('confirm')
  dialogVisible.value = false
}
</script>

<style scoped>
.logout-subtitle {
  font-size: 13px;
  color: rgba(173, 228, 242, 0.72);
  line-height: 1.6;
}

.logout-btn-cancel {
  border-color: rgba(173, 228, 242, 0.24) !important;
  color: #d8f8ff !important;
}

.logout-btn-confirm {
  background: linear-gradient(135deg, #f08b5b, #dd4d63) !important;
  color: #ffffff !important;
}
</style>