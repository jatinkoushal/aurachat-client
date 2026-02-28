import axios from 'axios';

const api = axios.create({
  baseURL: 'https://aurachat-server.onrender.com',
  withCredentials: true,
});

// No 401 redirect here - causes infinite reload loop
// Each component handles auth errors individually
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

export default api;
