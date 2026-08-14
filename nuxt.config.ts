// nuxt.config.ts

import tailwindcss from "@tailwindcss/vite";
import vuetify from "vite-plugin-vuetify";

export default defineNuxtConfig({
  /* =====================================================
   * NUXT
   * ===================================================== */

  ssr: false,

  compatibilityDate: "2025-07-15",

  devtools: {
    enabled: true,
  },

  devServer: {
    port: 3001,
    host: "0.0.0.0",
  },

  modules: ["@pinia/nuxt", "@nuxtjs/google-fonts"],

  /* =====================================================
   * APP / PWA / MOBILE SAFARI
   * ===================================================== */

  app: {
    head: {
      meta: [
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
        },

        /*
         * Android / Chrome PWA
         */
        {
          name: "mobile-web-app-capable",
          content: "yes",
        },

        /*
         * iOS Safari PWA
         */
        {
          name: "apple-mobile-web-app-capable",
          content: "yes",
        },

        /*
         * Safari status bar
         */
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },

        /*
         * Browser theme
         */
        {
          name: "theme-color",
          content: "#000000",
        },
      ],

      link: [
        /*
         * PWA manifest
         */
        {
          rel: "manifest",
          href: "/manifest.json",
        },

        /*
         * iOS Home Screen icon
         */
        {
          rel: "apple-touch-icon",
          href: "/icons/icon-192.png",
        },
      ],
    },
  },

  /* =====================================================
   * GLOBAL CSS
   * ===================================================== */

  css: ["~/assets/css/main.css"],

  /* =====================================================
   * VUETIFY
   * ===================================================== */

  build: {
    transpile: ["vuetify", "vue-sonner"],
  },

  /* =====================================================
   * VITE
   * ===================================================== */

  vite: {
    plugins: [
      tailwindcss() as any,

      vuetify({
        autoImport: true,
      }),
    ],

    ssr: {
      noExternal: ["vuetify"],
    },
  },

  /* =====================================================
   * RUNTIME CONFIG
   * ===================================================== */

  runtimeConfig: {
    public: {
      apiEndPoint: process.env.NUXT_PUBLIC_API_ENDPOINT,

      locale: process.env.NUXT_PUBLIC_APP_DEFAULT_LANGUAGE,

      baseURL: process.env.NUXT_PUBLIC_BASE_URL,

      websocket: process.env.NUXT_WEBSOCKET_URL,
    },
  },

  /* =====================================================
   * GOOGLE FONTS
   * ===================================================== */

  googleFonts: {
    outputDir: "assets/fonts/google",

    fontsDir: "assets/fonts/google",

    base64: true,

    families: {
      Battambang: [400, 700],

      Poppins: [300, 400, 500, 600, 700],
    },

    download: true,

    display: "swap",

    preload: true,

    useStylesheet: true,
  },
} as any);
