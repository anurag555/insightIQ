import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach workspace ID header if set in localStorage
api.interceptors.request.use((config) => {
  const activeWsId = localStorage.getItem('insightiq_workspace_id');
  if (activeWsId) {
    config.headers['x-workspace-id'] = activeWsId;
  }
  const token = localStorage.getItem('insightiq_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Optional auto-redirect or clear session if needed
    }
    return Promise.reject(error);
  }
);

export default api;
