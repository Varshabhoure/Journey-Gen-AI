import axios from 'axios';

// Set VITE_API_BASE_URL in frontend/.env when the backend is hosted elsewhere.
// Keep the existing local FastAPI address as the default.
const configuredBaseURL = import.meta.env.VITE_API_BASE_URL;
const baseURL =
  typeof configuredBaseURL === 'string' && configuredBaseURL.trim()
    ? configuredBaseURL.trim().replace(/\/+$/, '')
    : 'http://127.0.0.1:8000';

const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Login, registration and shared itineraries must work without a JWT.
const isPublicRequest = (config) => {
  try {
    const path = new URL(config?.url || '', config?.baseURL || baseURL).pathname;
    return /^\/public(?:\/|$)/.test(path) ||
      /^\/auth\/(?:login|register)\/?$/.test(path);
  } catch {
    return false;
  }
};

const readAuthorization = (headers) => {
  if (!headers) return '';
  return String(
    typeof headers.get === 'function'
      ? headers.get('Authorization') || ''
      : headers.Authorization || headers.authorization || ''
  );
};

const setAuthorization = (headers, value) => {
  if (typeof headers.set === 'function') {
    headers.set('Authorization', value);
  } else {
    headers.Authorization = value;
  }
};

const clearAuthorization = (headers) => {
  if (!headers) return;
  if (typeof headers.delete === 'function') {
    headers.delete('Authorization');
  } else {
    delete headers.Authorization;
    delete headers.authorization;
  }
};

// Attach the saved JWT only to private requests.
API.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};

    if (isPublicRequest(config)) {
      clearAuthorization(config.headers);
      return config;
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      setAuthorization(config.headers, `Bearer ${token}`);
    } else {
      clearAuthorization(config.headers);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// A private 401 means the session is no longer valid. Never redirect visitors
// or clear their session because a public link or login attempt failed.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isPublicRequest(error.config)) {
      const currentToken = localStorage.getItem('access_token');
      const requestAuthorization = readAuthorization(error.config?.headers);

      // Ignore a late 401 from an old request after a different login occurred.
      const fromOlderSession =
        currentToken &&
        requestAuthorization &&
        requestAuthorization !== `Bearer ${currentToken}`;

      if (!fromOlderSession) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');

        if (!['/login', '/signup'].includes(window.location.pathname)) {
          window.location.assign('/login');
        }
      }
    }

    return Promise.reject(error);
  }
);

export default API;
