import axios from 'axios';
import { getToken } from './storage';

// CHANGE THIS TO YOUR LOCAL IP ADDRESS
const API_URL = 'http://172.28.15.234:8001/api';

// Default timeout for fast endpoints (auth, profile, search, history...) — 30s is plenty.
const DEFAULT_TIMEOUT = 30000;

// Long timeout for AI endpoints that hit Ollama locally (llama3.1:8b can take 30-90s).
// Use this on /products/alternatives and /products/coach-tips calls.
export const AI_TIMEOUT_MS = 180000; // 3 minutes

const api = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export { API_URL };
