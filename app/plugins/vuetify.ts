// app/plugins/vuetify.ts
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.min.css";
import "vuetify-sonner/style.css";

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    directives,

    theme: {
      defaultTheme: "light",

      themes: {
        light: {
          dark: false,

          colors: {
            primary: "#326690",     
            secondary: "#848EA0",  
            background: "#F4F6F8",
            surface: "#FFFFFF",

            accent: "#D6EFFC",      
            success: "#43A047",
            warning: "#EEA236",
            error: "#E53935",
            info: "#326690",       

            create: "#75BCE5",      
            cancel: "#848EA0",      

            navy: "#213448",
            slate: "#547792",
            steel: "#94B4C1",
            beige: "#EAE0CF",

            "on-background": "#26333F",
            "on-surface": "#26333F",

            "on-primary": "#FFFFFF",
            "on-secondary": "#FFFFFF",
            "on-accent": "#26333F",   
            "on-warning": "#FFFFFF",
            "on-error": "#FFFFFF",
            "on-info": "#FFFFFF",
            "on-create": "#FFFFFF",
            "on-cancel": "#FFFFFF",

            "on-navy": "#FFFFFF",
            "on-slate": "#FFFFFF",
            "on-steel": "#26333F",
            "on-beige": "#26333F",

            "on-lose": "#EF4444",
            "on-win": "#1E9C07",

            "close-btn": "#E53935",
          },
        },
      },
    },
  });

  nuxtApp.vueApp.use(vuetify);
});