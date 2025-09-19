// Ambil cookie
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

// Set cookie biasa
export function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "expires=" + d.toUTCString();
  document.cookie = `${name}=${encodeURIComponent(
    value
  )};${expires};path=/;SameSite=Lax`;
}

// Set cookie “secure” (nama saja, browser client tidak bisa bikin httpOnly/secure asli)
export function setSecureCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "expires=" + d.toUTCString();
  document.cookie = `${name}=${encodeURIComponent(
    value
  )};${expires};path=/;SameSite=Lax;Secure`;
}

// Hapus cookie
export function eraseCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

// === LocalStorage fallback ===
export function setLocalToken(token: string) {
  localStorage.setItem("token", token);
}

export function getLocalToken(): string | null {
  return localStorage.getItem("token");
}

export function clearLocalToken() {
  localStorage.removeItem("token");
}
