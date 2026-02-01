const BASE_URL = import.meta.env.VITE_API_URL || ''

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || `Request failed: ${res.status}`)
  }

  return res.json()
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  // Use XMLHttpRequest for large file uploads (better Firefox compatibility)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}${path}`)

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('Invalid JSON response'))
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText)
          reject(new Error(body?.error?.message || `Upload failed: ${xhr.status}`))
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout = 300000 // 5 minute timeout for large files

    xhr.send(formData)
  })
}
