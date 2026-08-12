const ACCESS_TOKEN_KEY = "accessToken";

export function useAccessTokenState() {
  return useState<string | null>(ACCESS_TOKEN_KEY, () => null);
}

export function hydrateAccessToken() {
  const token = useAccessTokenState();

  if (import.meta.client) {
    token.value = localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  return token;
}

export function getAccessToken() {
  if (!import.meta.client) return null;

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(value: string) {
  const token = useAccessTokenState();
  token.value = value;

  if (import.meta.client) {
    localStorage.setItem(ACCESS_TOKEN_KEY, value);
  }
}

export function clearAccessToken() {
  const token = useAccessTokenState();
  token.value = null;

  if (import.meta.client) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}