const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('username')
    window.location.href = '/login'
    throw new Error('Phiên đăng nhập hết hạn')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || `Lỗi ${response.status}`)
  }
  return response.json()
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })
    return handleResponse<T>(res)
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    })
    return handleResponse<T>(res)
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    })
    return handleResponse<T>(res)
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    return handleResponse<T>(res)
  },
}
