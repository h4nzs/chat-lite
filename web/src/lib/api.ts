const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";

// Cache untuk token CSRF
let csrfTokenCache: string | null = null;

/**
 * Mengambil token CSRF dari server dan menyimpannya di cache.
 */
export async function getCsrfToken(): Promise<string> {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }
  try {
    const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: "include" });
    if (!res.ok) {
      throw new Error(`Failed to fetch CSRF token: ${res.status}`);
    }
    const data = await res.json();
    csrfTokenCache = data.csrfToken;
    return csrfTokenCache!;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    // Reset cache jika terjadi error
    csrfTokenCache = null;
    throw error;
  }
}

// ... (sisa kode api.ts, termasuk class ApiError)

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Tambahkan token CSRF ke header untuk request yang mengubah state
  if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase())) {
    // Jangan tambahkan Content-Type untuk FormData, browser akan menentukannya sendiri
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    try {
      const token = await getCsrfToken();
      headers['CSRF-Token'] = token;
    } catch (e) {
      console.error("Could not attach CSRF token");
    }
  }

  const res = await fetch(API_URL + path, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    // Jika token CSRF tidak valid, bersihkan cache agar request selanjutnya mengambil token baru
    if (res.status === 403 && text.includes('invalid csrf token')) {
        csrfTokenCache = null;
    }
    throw new ApiError(res.status, res.statusText, text);
  }

  // Handle response tanpa body (misal: 204 No Content)
  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

/**
 * Wrapper untuk request yang butuh auth.
 * Jika 401 → coba refresh token sekali.
 */
export async function authFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    return await api<T>(url, options);
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 401 || /Unauthorized/i.test(err.message))
    ) {
      try {
        // coba refresh
        const refreshRes = await api<{ ok: boolean }>("/api/auth/refresh", {
          method: "POST",
        });

        if (refreshRes.ok) {
          // ulang sekali
          return await api<T>(url, options);
        }
      } catch {
        // refresh gagal → redirect login
        document.cookie =
          "at=; Max-Age=0; path=/; SameSite=Lax; Secure"; // hapus cookie at
        window.location.href = "/login";
        throw new ApiError(401, "Session expired, please log in again");
      }
    }
    throw err;
  }
}

/**
 * Helper untuk mapping error ke pesan user-friendly.
 */
export function handleApiError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.status) {
      case 0:
        return "Network connection failed. Please check your internet connection.";
      case 400:
        return `Invalid request: ${e.message}`;
      case 401:
        return "Authentication failed. Please log in again.";
      case 403:
        return "Access denied. You don't have permission to perform this action.";
      case 404:
        return "Resource not found.";
      case 500:
        return "Server error. Please try again later.";
      default:
        return e.message || "An error occurred. Please try again.";
    }
  }

  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
