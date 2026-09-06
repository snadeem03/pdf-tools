import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'
});

/**
 * Generic file processing API call.
 * @param {string} endpoint - API path (e.g. '/merge')
 * @param {FormData} formData - FormData with files and options
 * @param {function} onProgress - progress callback (0-100)
 * @returns {Promise<{blob: Blob, filename: string, headers: object}>}
 */
export async function processFiles(endpoint, formData, onProgress) {
  const response = await api.post(endpoint, formData, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (e.total) {
        const pct = Math.round((e.loaded / e.total) * 50); // Upload = 0-50%
        onProgress?.(pct);
      }
    },
    onDownloadProgress: (e) => {
      if (e.total) {
        const pct = 50 + Math.round((e.loaded / e.total) * 50); // Download = 50-100%
        onProgress?.(pct);
      } else {
        onProgress?.(75);
      }
    },
  });

  // If the server returned an error status, the blob is likely an HTML/JSON
  // error page — not the expected PDF. Parse it and throw so callers get a
  // meaningful error instead of a corrupted download.
  const contentType = response.headers['content-type'] || '';
  if (response.status < 200 || response.status >= 300) {
    const text = await response.data.text();
    let message = `Request failed (${response.status})`;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || message;
    } catch {
      message = text.slice(0, 200) || message;
    }
    throw new Error(message);
  }

  // Even with a 2xx status, a JSON Content-Type means the backend sent an
  // error object (e.g. 200 with { success: false, error: "..." }).
  if (contentType.includes('application/json')) {
    const text = await response.data.text();
    try {
      const json = JSON.parse(text);
      if (json.success === false || json.error) {
        throw new Error(json.error || 'An error occurred');
      }
    } catch (parseErr) {
      if (parseErr.message && parseErr.message !== 'An error occurred') throw parseErr;
    }
  }

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers['content-disposition'];
  let filename = 'output';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?(.+?)"?$/);
    if (match) filename = match[1];
  }

  return { blob: response.data, filename, headers: response.headers };
}

export default api;
