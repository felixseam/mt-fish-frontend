<template>
  <div class="login-page">
    <LanguageSwitcher />
    <div class="login-page__backdrop" />

    <v-container class="fill-height d-flex align-center justify-center">
      <v-sheet class="login-shell" rounded="xl" elevation="24">
        <div class="login-shell__glow" />

        <div class="login-shell__header">
          <!-- <p class="login-shell__eyebrow">Aqua Area</p> -->
          <h1 class="login-shell__title">Login</h1>
          <!-- <p class="login-shell__subtitle">
            {{ t('login.subtitle') }}
          </p> -->
        </div>

        <v-form class="login-form" @submit.prevent="handleLogin">
          <v-text-field
            v-model="user_name"
            :label="t('login.username')"
            :placeholder="t('login.usernamePlaceholder')"
            autocomplete="username"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            prepend-inner-icon="mdi-account-outline"
            :error-messages="errors.user_name ? [errors.user_name] : []"
            hide-details="auto"
            class="login-form__field"
          />

          <v-text-field
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            :label="t('login.password')"
            :placeholder="t('login.passwordPlaceholder')"
            autocomplete="current-password"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :error-messages="errors.password ? [errors.password] : []"
            hide-details="auto"
            class="login-form__field"
            @click:append-inner="togglePasswordVisibility"
          />

          <v-btn
            type="submit"
            color="info"
            size="x-large"
            rounded="lg"
            block
            :loading="isLoggingIn"
            class="login-form__submit"
          >
            {{ t('login.action') }}
          </v-btn>
        </v-form>
      </v-sheet>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import LanguageSwitcher from "~/components/LanguageSwitcher.vue";
import { useAuthStore } from "~/stores/authStore";
import { sonnerToast } from "~/utils/sonnerToast";

type Errors = {
  user_name?: string;
  password?: string;
};

definePageMeta({
  layout: false,
});

const showPassword = ref(false);
const isLoggingIn = ref(false);
const authStore = useAuthStore();
const errors = ref<Errors>({});
const { t } = useFrontendI18n();

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;

  if (!error || typeof error !== "object") {
    return t("login.failedMessage");
  }

  const payload = error as Record<string, unknown>;
  const directMessage = payload.message ?? payload.error;

  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage;
  }

  const nestedData = payload.data;
  if (nestedData && typeof nestedData === "object") {
    const dataRecord = nestedData as Record<string, unknown>;
    const nestedMessage = dataRecord.message ?? dataRecord.error;

    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  const nestedErrors = payload.errors;
  if (nestedErrors && typeof nestedErrors === "object") {
    const firstError = Object.values(nestedErrors as Record<string, unknown>).find(
      (value) =>
        (typeof value === "string" && value.trim()) ||
        (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()),
    );

    if (typeof firstError === "string") {
      return firstError;
    }

    if (Array.isArray(firstError) && typeof firstError[0] === "string") {
      return firstError[0];
    }
  }

  return t("login.failedMessage");
}

const user_name = computed({
  get: () => authStore.user.user_name ?? "",
  set: (value: string) => {
    authStore.user.user_name = value.replace(/\s+/g, "").toUpperCase();
  },
});

const password = computed({
  get: () => authStore.user.password ?? "",
  set: (value: string) => {
    authStore.user.password = value.replace(/\s+/g, "");
  },
});

function togglePasswordVisibility() {
  showPassword.value = !showPassword.value;
}

async function handleLogin() {
  isLoggingIn.value = true;
  errors.value = {};

  try {
    if (!user_name.value) {
      errors.value.user_name = t("login.usernameRequired");
      sonnerToast(t("login.missingUsername"), t("login.usernameRequired"), "warning");
      return;
    }

    if (!password.value) {
      errors.value.password = t("login.passwordRequired");
      sonnerToast(t("login.missingPassword"), t("login.passwordRequired"), "warning");
      return;
    }

    await authStore.fetchLogin();
    sonnerToast(t("login.successTitle"), t("login.successMessage"), "login");
  } catch (error: unknown) {
    sonnerToast(t("login.failedTitle"), extractErrorMessage(error), "error");
  } finally {
    isLoggingIn.value = false;
  }
}
</script>

<style scoped>
.login-page {
  position: fixed;
  inset: 0;
  min-height: 100dvh;
  background:
    linear-gradient(rgba(2, 10, 18, 0.45), rgba(2, 10, 18, 0.72)),
    url("/fish/fish-all-star/resources/background/login_bg.png") center / cover no-repeat;
}

.login-page__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top, rgba(248, 205, 93, 0.16), transparent 32%),
    radial-gradient(circle at bottom, rgba(61, 175, 226, 0.22), transparent 30%);
}

.login-shell {
  position: relative;
  z-index: 1;
  width: min(460px, calc(100vw - 32px));
  padding: 30px 28px 26px;
  overflow: hidden;
  border: 1px solid rgba(255, 219, 127, 0.22);
  background: rgba(7, 19, 31, 0.82);
  backdrop-filter: blur(18px);
}

.login-shell__glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 221, 115, 0.22), transparent 34%),
    radial-gradient(circle at 82% 88%, rgba(94, 218, 255, 0.16), transparent 38%);
}

.login-shell__header,
.login-form {
  position: relative;
  z-index: 1;
}

.login-shell__header {
  margin-bottom: 20px;
  text-align: center;
}

.login-shell__eyebrow {
  margin: 0 0 8px;
  color: rgba(255, 224, 145, 0.88);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.login-shell__title {
  margin: 0;
  color: #f4fbff;
  font-size: clamp(2rem, 4vw, 2.5rem);
  font-weight: 800;
}

.login-shell__subtitle {
  margin: 10px 0 0;
  color: rgba(217, 237, 247, 0.8);
  line-height: 1.6;
}

.login-form__field {
  margin-bottom: 16px;
}

.login-form :deep(.v-field) {
  background: rgba(255, 255, 255, 0.06);
}

.login-form :deep(.v-field__input),
.login-form :deep(.v-label),
.login-form :deep(.v-icon) {
  color: #eef8ff;
}

.login-form :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgba(165, 214, 241, 0.28);
}

.login-form__submit {
  margin-top: 10px;
  min-height: 54px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

@media (max-width: 600px) {
  .login-shell {
    width: min(100vw - 24px, 420px);
    padding: 24px 20px 22px;
  }
}
</style>
