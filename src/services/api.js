import axios from 'axios';

const api = axios.create({
  baseURL: 'https://aurachat-server.onrender.com',
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

export default api;
