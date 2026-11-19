import { API_CONFIG } from './config';
import { ApiError } from './types';

/**
 * Native HTTP Client (Fetch-based)
 * Tối ưu hóa cực nhẹ cho React Native, tương thích 100% với Backend MediAssistRover.
 * Hỗ trợ tự động gắn Token Bearer, Timeout, bắt lỗi mạng và format dữ liệu.
 */

/**
 * Nhận diện payload multipart (`FormData` chuẩn Web/Node hoặc `FormData` của React Native)
 * để không gắn `Content-Type: application/json` hay gọi `JSON.stringify`.
 */
export function isMultipartFormData(body: unknown): body is FormData {
  if (!body || typeof body !== 'object') return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return true;
  }
  const candidate = body as {
    append?: unknown;
    _parts?: unknown;
    constructor?: { name?: string };
  };
  return (
    typeof candidate.append === 'function' &&
    (Array.isArray(candidate._parts) || candidate.constructor?.name === 'FormData')
  );
}

export class ApiClient {
  private customBaseUrl: string | null = null;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private sessionListener: ((accessToken: string | null, refreshToken: string | null) => void) | null = null;

  public getBaseUrl(): string {
    return this.customBaseUrl || API_CONFIG.BASE_URL;
  }

  public setBaseUrl(url: string | null) {
    this.customBaseUrl = url;
  }

  // Cập nhật Token xác thực khi đăng nhập thành công
  public setToken(token: string | null) {
    this.token = token;
  }

  public setRefreshToken(refreshToken: string | null) {
    this.refreshToken = refreshToken;
  }

  public setSession(accessToken: string | null, refreshToken: string | null) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    this.sessionListener?.(accessToken, refreshToken);
  }

  public setSessionListener(
    listener: ((accessToken: string | null, refreshToken: string | null) => void) | null
  ) {
    this.sessionListener = listener;
  }

  public getToken(): string | null {
    return this.token;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  // Hàm gọi HTTP cốt lõi với Timeout
  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    allowRefresh = true
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const multipart = isMultipartFormData(options.body);

    const callerHeaders: Record<string, string> = {};
    if (options.headers && typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
      for (const [k, v] of Object.entries(options.headers as Record<string, string>)) {
        if (multipart && k.toLowerCase() === 'content-type') continue;
        if (v !== undefined) callerHeaders[k] = v;
      }
    }

    const headers: Record<string, string> = {
      ...(multipart ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...callerHeaders,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Thiết lập timeout tự ngắt nếu mạng đơ (tải tệp multipart cần thời gian lâu hơn JSON)
    const controller = new AbortController();
    const timeoutMs = multipart ? Math.max(API_CONFIG.TIMEOUT_MS, 45_000) : API_CONFIG.TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[API REQUEST] ${options.method || 'GET'} ${url}`);
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => null);

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // Responses may contain access tokens, QR proofs or authorization grants.
        console.log(`[API RESPONSE] ${response.status} ${url}`);
      }

      if (
        response.status === 401 &&
        allowRefresh &&
        this.refreshToken &&
        !endpoint.includes('/auth/login') &&
        !endpoint.includes('/auth/refresh')
      ) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          return this.request<T>(endpoint, options, false);
        }
      }

      if (!response.ok) {
        const error: ApiError = {
          status: response.status,
          message: responseData?.message || `Lỗi máy chủ (${response.status})`,
          code: responseData?.error || responseData?.code,
          details: responseData?.violations || responseData?.details,
        };
        throw error;
      }

      return responseData as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err?.name === 'AbortError' || controller.signal.aborted) {
        const timeoutError: ApiError = {
          status: 408,
          message: 'Kết nối mạng bị quá hạn (Timeout). Vui lòng thử lại!',
        };
        throw timeoutError;
      }

      // Lỗi đọc/đóng gói request trên client (ví dụ FormDataPart không đọc được bytes) hoặc lỗi mạng
      if (!err?.status) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[API ERROR]', endpoint, err?.message || err);
        }
        if (
          multipart &&
          /Unsupported FormDataPart|Unsupported BodyInit|cannot be read|no such file|ENOENT/i.test(
            String(err?.message || '')
          )
        ) {
          const clientError: ApiError = {
            status: 0,
            code: 'CLIENT_REQUEST_ERROR',
            message:
              'Không thể đọc hoặc đóng gói tệp ảnh trên thiết bị. Vui lòng chọn hoặc chụp lại ảnh.',
            details: err?.message,
          };
          throw clientError;
        }
        const networkError: ApiError = {
          status: 0,
          message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng!',
          details: err?.message,
        };
        throw networkError;
      }

      throw err;
    }
  }

  private async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.getBaseUrl()}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            refreshToken: this.refreshToken,
            deviceInfo: 'StaffApp-Mobile',
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.accessToken) {
          this.setSession(null, null);
          return false;
        }
        this.setSession(data.accessToken, data.refreshToken || this.refreshToken);
        return true;
      } catch {
        this.setSession(null, null);
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // GET
  public get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  // POST (hỗ trợ cả JSON mặc định và multipart/form-data khi body là FormData)
  public post<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    const multipart = isMultipartFormData(body);
    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });
  }

  // POST multipart/form-data (tự để fetch tạo Content-Type và boundary)
  public postMultipart<T>(
    endpoint: string,
    formData: FormData,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });
  }

  // PUT
  public put<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // DELETE
  public delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const apiClient = new ApiClient();
