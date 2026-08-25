// nuxt.config.ts

import tailwindcss from "@tailwindcss/vite";
import vuetify from "vite-plugin-vuetify";

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2025-07-15",
  modules: ["@pinia/nuxt", "@nuxtjs/google-fonts"],
  app: {
    head: {
      meta: [
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
        },
        {
          name: "mobile-web-app-capable",
          content: "yes",
        },

        {
          name: "apple-mobile-web-app-capable",
          content: "yes",
        },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
        {
          name: "theme-color",
          content: "#000000",
        },
      ],

      link: [
        {
          rel: "manifest",
          href: "/manifest.json",
        },
        {
          rel: "apple-touch-icon",
          href: "/icons/icon-192.png",
        },
      ],
    },
  },


  css: ["~/assets/css/main.css"],
  build: {
    transpile: ["vuetify", "vue-sonner"],
  },

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


  runtimeConfig: {
    public: {
      apiEndPoint: process.env.NUXT_PUBLIC_API_ENDPOINT,

      locale: process.env.NUXT_PUBLIC_APP_DEFAULT_LANGUAGE,

      baseURL: process.env.NUXT_PUBLIC_BASE_URL,

      websocket: process.env.NUXT_WEBSOCKET_URL,
    },
  },

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

  devtools: {
    enabled: true,
  },

  devServer: {
    port: 3000,
    host: "0.0.0.0",
  },
} as any);
