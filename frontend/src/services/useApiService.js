import { useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useKeycloak } from '@react-keycloak/web';
import CONFIG from '../config';

const useApiService = (opts = {}) => {
  const { keycloak } = useKeycloak();
  const apiService = axios.create({
    baseURL: CONFIG.API_BASE,
    ...opts,
  });

  apiService.interceptors.request.use(
    (config) => {
      if (keycloak.authenticated) {
        config.headers.Authorization = `Bearer ${keycloak.token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  return apiService;
}

export default useApiService;
