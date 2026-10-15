import { API_CONFIG } from './config';
import { ApiResponse, ApiError } from './types';

/**
 * Native HTTP Client (Fetch-based)
 * Tối ưu hóa cực nhẹ cho React Native, không cần cài thêm thư viện ngoài.
 * Hỗ trợ tự động gắn Token, Timeout, bắt lỗi mạng và format dữ liệu chuẩn.
 */

class ApiClient {
  private baseUrl: string = API_CONFIG.BASE_URL;
  private token: string | null = null;

  // Cập nhật Token xác thực khi đăng nhập thành công
  public setToken(token: string | null) {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  // Hàm gọi HTTP cốt lõi với Timeout
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Thiết lập timeout tự ngắt nếu mạng đơ
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

    try {
      if (__DEV__) {
        console.log(`[API REQUEST] ➔ ${options.method || 'GET'} ${url}`, options.body || '');
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => null);

      if (__DEV__) {
        console.log(`[API RESPONSE] ⬅ ${response.status} ${url}`, responseData);
      }

      if (!response.ok) {
        const error: ApiError = {
          status: response.status,
          message: responseData?.message || `Lỗi máy chủ (${response.status})`,
          code: responseData?.code,
          details: responseData?.details,
        };
        throw error;
      }

      return responseData as ApiResponse<T>;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        const timeoutError: ApiError = {
          status: 408,
          message: 'Kết nối mạng bị quá hạn (Timeout). Vui lòng thử lại!',
        };
        throw timeoutError;
      }

      // Lỗi mạng hoặc server không phản hồi
      if (!err.status) {
        const networkError: ApiError = {
          status: 0,
          message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng!',
          details: err.message,
        };
        throw networkError;
      }

      throw err;
    }
  }

  // GET
  public get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  // POST
  public post<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // PUT
  public put<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // DELETE
  public delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const apiClient = new ApiClient();
