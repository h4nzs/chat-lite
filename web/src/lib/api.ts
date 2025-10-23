const API_URL =
  (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";

// === Custom error class ===
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

// CSRF token cache
let csrfToken: string | null = null;
let csrfTokenExpiry: number | null = null;

// Function to fetch CSRF token
async function fetchCsrfToken(): Promise<string> {
  // Check if we have a valid cached token
  if (csrfToken && csrfTokenExpiry && Date.now() < csrfTokenExpiry) {
    return csrfToken;
  }

  try {
    const res = await fetch(`${API_URL}/api/csrf-token`, {
      credentials: "include",
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch CSRF token: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    csrfToken = data.csrfToken;
    
    // Set expiry time (CSRF tokens can typically be reused until a new one is generated)
    // For safety, we'll refresh it after 1 hour
    csrfTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
    
    return csrfToken;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    throw error;
  }
}

/**
 * Wrapper fetch untuk API.
 * Selalu kirim credentials supaya cookie (at/rt) ikut terkirim.
 */
export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    // Check if this is an auth request that needs CSRF token
    const needsCsrfToken = path.includes('/auth/') && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH' || options.method === 'DELETE');
    
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };
    
    // Add CSRF token for auth requests
    if (needsCsrfToken) {
      const token = await fetchCsrfToken();
      headers = {
        ...headers,
        "CSRF-Token": token,
      };
    }

    const res = await fetch(API_URL + path, {
      ...options,
      credentials: "include", // 🔥 cookie at/rt otomatis ikut
      headers,
    });

    // If there's a CSRF token error, clear the cached token
    if (res.status === 403) {
      const errorText = await res.text();
      if (errorText.includes('invalid csrf token') || res.headers.get('content-type')?.includes('application/json')) {
        const jsonError = JSON.parse(errorText);
        if (jsonError?.message?.toLowerCase().includes('csrf') || jsonError?.error?.toLowerCase().includes('csrf')) {
          csrfToken = null;
          csrfTokenExpiry = null;
        }
      }
      // Re-throw with error details
      throw new ApiError(res.status, errorText);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, res.statusText, text);
    }

    return res.json();
  } catch (error: any) {
    // Network errors
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new ApiError(
        0,
        "Network error. Please check your connection and try again."
      );
    }

    // Re-throw ApiError
    if (error instanceof ApiError) throw error;

    // Generic fallback
    throw new ApiError(500, "An unexpected error occurred. Please try again.");
  }
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
