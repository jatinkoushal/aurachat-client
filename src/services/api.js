import axios from 'axios';

const BACKEND_URL = 'https://aurachat-server.onrender.com';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || BACKEND_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
