import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
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
