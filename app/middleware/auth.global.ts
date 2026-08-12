import { hydrateAccessToken } from "~/utils/authToken";

export default defineNuxtRouteMiddleware((to) => {
    const { authenticated } = storeToRefs(useAuthStore());
    const token = hydrateAccessToken();
    
    if (token.value) {
        authenticated.value = true;
    }
    
    if (!to.matched.length && to.name !== 'not-found') {
        return navigateTo('/not-found');
    }
    
    if (token.value && to?.name === 'login') {
        return navigateTo('/');
    }
    
    if (!token.value && to?.name !== 'login' && to?.name !== 'not-found') {
        return navigateTo('/login');
    }

    
});
