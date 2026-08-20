import type { UseFetchOptions } from "nuxt/app";
import { defu } from "defu";
import { storeToRefs } from "pinia";
import { useAuthStore } from "~/stores/authStore";
import { clearAccessToken, getAccessToken } from "~/utils/authToken";

export async function useApiInterceptor<T>(
  url: string,
  options: UseFetchOptions<T> = {},
  opts?: {
    redirectOnError?: boolean;
  },
) {
  const accessToken = getAccessToken();
  const { authenticated } = storeToRefs(useAuthStore());
  const config = useRuntimeConfig();
  const frontendLang = import.meta.client
    ? localStorage.getItem("lang") || "km"
    : "km";
  const lang = frontendLang === "km" ? "kh" : frontendLang;
  const defaults = {
    baseURL: config.public.apiEndPoint,
    key: url,
    headers: {
      ...(accessToken && {
        Authorization: `Bearer ${accessToken}`,
      }),
      "Accept-Language": lang,
    },
  };

  const params = defu(options, defaults);

  try {
    const response = await $fetch<T>(url, params as any);
    return { data: shallowRef(response) };
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?._data;

    if (status === 401 || status === 422) {
      console.warn(`${status} error detected. Redirecting to login.`);
      authenticated.value = false;
      clearAccessToken();

      await navigateTo("/login");

      if (opts?.redirectOnError === false) {
        throw {
          status,
          message: errorData?.message ?? "Unauthorized",
          raw: errorData,
        };
      }

      return;
    }

    throw errorData;
  }
}