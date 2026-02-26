// src/utils/auth-utils.ts

export class AuthUtils {
  private static ACCESS_KEY = 'ACCESS_TOKEN'; // 访问令牌
  private static REFRESH_KEY = 'REFRESH_TOKEN'; // 刷新令牌

  private static get storage(): Storage | null {
    return typeof window !== 'undefined' ? localStorage : null;
  }

  static redirectToLogin(): void {
    if (typeof window === 'undefined') return;
    const redirectUrl = encodeURIComponent(window.location.href);
    window.location.href = `/login?redirect=${redirectUrl}`;
  }

  static getToken(): string | null {
    return this.storage?.getItem(this.ACCESS_KEY) ?? null;
  }

  static setToken(token: string): void {
    this.storage?.setItem(this.ACCESS_KEY, token);
  }

  static getRefreshToken(): string | null {
    return this.storage?.getItem(this.REFRESH_KEY) ?? null;
  }

  static setRefreshToken(token: string): void {
    this.storage?.setItem(this.REFRESH_KEY, token);
  }

  static removeToken(): void {
    this.storage?.removeItem(this.ACCESS_KEY);
    this.storage?.removeItem(this.REFRESH_KEY);
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * 刷新 AccessToken
   */
  static async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch('/admin-api/system/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) return null;
      const result = await res.json();

      if (result.code !== 0) return null;
      console.log('refreshAccessToken', result); 
      const newToken = result.data?.accessToken;
      if (!newToken) return null;

      this.setToken(newToken);
      return newToken;
    } catch {
      return null;
    }
  }

  /**
   * 构建Headers
   */
  static buildHeaders(
    token: string,
    customHeaders?: HeadersInit,
    hasBody: boolean = false
  ): HeadersInit {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...customHeaders
    };
    
    return headers;
  }
}
