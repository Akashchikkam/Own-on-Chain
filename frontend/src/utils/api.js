const DEFAULT_BACKEND_URL = 'http://localhost:3001';

function normalizeBaseUrl(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) {
    return DEFAULT_BACKEND_URL;
  }
  return url.replace(/\/+$/, '');
}

export function getBackendBaseUrl() {
  const rawUrl = import.meta.env?.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;
  const normalized = normalizeBaseUrl(rawUrl);
  if (normalized.toLowerCase().endsWith('/api')) {
    return normalized.slice(0, -4);
  }
  return normalized;
}

export function getBackendApiUrl(path = '') {
  const baseUrl = getBackendBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const sanitizedPath = normalizedPath.replace(/^\/api\b/i, '');
  return `${baseUrl}/api${sanitizedPath}`;
}

