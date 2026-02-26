// src/api/api-client.ts
import { AuthUtils } from '../utils/auth-utils';

const BASE_URL = 'http://113.200.109.142:48080';

interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
  headers: Headers;
}

interface RequestOptions {
  params?: Record<string, any>;
  data?: any;
  headers?: HeadersInit;
  timeout?: number;
}

class ApiClient {
  private defaultTimeout = 30000;
  private refreshPromise: Promise<string | null> | null = null; // 刷新锁

  /**
   * 统一请求入口（核心方法）
   */
  private async request<T>(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      params,
      data,
      headers: customHeaders,
    } = options;

    let url = `${BASE_URL}${endpoint}`;
    console.log('---parmas---是', params)

    // query参数拼接
    if (params && Object.keys(params).length > 0) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          search.append(key, String(value));
        }
      });
      const queryString = search.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    console.log('---url---是', url)


    // 获取token
    const token = AuthUtils.getToken();
    if (!token) {
      AuthUtils.redirectToLogin();
      throw new Error('没有token，请登录！');
    }

    // 超时判断
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
    
    const requestBody = (data !== undefined && method !== 'GET') ? JSON.stringify(data) : undefined;
    const requestHeaders = AuthUtils.buildHeaders(token, customHeaders, requestBody !== undefined);

    const config: RequestInit = {
      method,
      headers: requestHeaders,
      signal: controller.signal
    };

    if (requestBody) {
      config.body = requestBody;
    }

    try {
      let response = await fetch(url, config);

      /**
       * token失效自动刷新（支持并发）
       */
      if (response.status === 401) {
        if (!this.refreshPromise) {
          this.refreshPromise = AuthUtils.refreshAccessToken()
            .finally(() => {
              this.refreshPromise = null;
            });
        }

        try {
          const newToken = await this.refreshPromise;
          if (!newToken) {
            AuthUtils.removeToken();
            AuthUtils.redirectToLogin();
            throw new Error('请重新登录！');
          }
          config.headers = AuthUtils.buildHeaders(newToken, customHeaders, requestBody !== undefined);
          response = await fetch(url, config);
        } catch (err) {
          this.refreshPromise = null;
          throw err;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} — ${errorText}`);
      }

      const result = await response.json();
      const { code, msg, data: responseData } = result;
      if (code !== 0) {
        if (code === 401) {
          AuthUtils.removeToken();
          AuthUtils.redirectToLogin();
          throw new Error('认证失败，请重新登录！');
        }
        throw new Error(`${msg} (${code})`);
      }
      return {
        code,
        msg,
        data: responseData,
        headers: response.headers
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** GET */
  get<T = any>(endpoint: string, options?: Omit<RequestOptions, 'data'>) {
    return this.request<T>('GET', endpoint, options);
  }

  /** POST */
  post<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>('POST', endpoint, options);
  }

  /** PUT */
  put<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>('PUT', endpoint, options);
  }

  /** DELETE */
  delete<T = any>(endpoint: string, options?: Omit<RequestOptions, 'data'>) {
    return this.request<T>('DELETE', endpoint, options);
  }
}

export default new ApiClient();
