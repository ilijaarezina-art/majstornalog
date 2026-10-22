import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Određivanje podrazumevanog endpoint-a
const getDefaultApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return 'http://localhost/majstornalog/api.php';
    }
    // Ako se pokreće na bookmymusic.rs ili live hostingu
    return `${origin}/majstornalog/api.php`;
  }
  // Za mobilni Android / iOS produkciju
  return 'https://bookmymusic.rs/majstornalog/api.php';
};

let API_BASE_URL = getDefaultApiUrl();

export const setCustomApiUrl = async (url) => {
  if (url) {
    API_BASE_URL = url;
    await AsyncStorage.setItem('@majstornalog:api_url', url);
  }
};

export const initApiUrl = async () => {
  try {
    const saved = await AsyncStorage.getItem('@majstornalog:api_url');
    if (saved) {
      API_BASE_URL = saved;
    }
  } catch (e) {}
  return API_BASE_URL;
};

const request = async (action, options = {}) => {
  const method = options.method || 'GET';
  const url = `${API_BASE_URL}?action=${encodeURIComponent(action)}${options.query ? '&' + options.query : ''}`;
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const fetchOptions = {
    method,
    headers,
  };

  if (options.body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      throw new Error(`Nevalidan odgovor servera (${response.status}): ${text.substring(0, 100)}`);
    }

    if (!response.ok || json.status === 'error') {
      throw new Error(json.message || `Greška servera: ${response.status}`);
    }

    return json.data;
  } catch (err) {
    console.warn(`[API] Akcija ${action} neuspešna:`, err.message);
    throw err;
  }
};

export const api = {
  login: async (email, password) => {
    return request('login', {
      method: 'POST',
      body: { email, password }
    });
  },

  getMyOrders: async (workerId, date = '') => {
    const query = `majstor_id=${encodeURIComponent(workerId)}${date ? `&datum=${encodeURIComponent(date)}` : ''}`;
    return request('get_my_orders', { query });
  },

  getOrderDetails: async (orderId) => {
    return request('get_order_details', {
      query: `order_id=${encodeURIComponent(orderId)}`
    });
  },

  updateOrderStatus: async (orderId, status, workerId = null, comment = '') => {
    return request('update_order_status', {
      method: 'POST',
      body: {
        order_id: orderId,
        status,
        majstor_id: workerId,
        komentar: comment
      }
    });
  },

  completeOrder: async (payload) => {
    return request('complete_order', {
      method: 'POST',
      body: payload
    });
  },

  getCatalog: async (firmId, query = '') => {
    const qStr = `firma_id=${encodeURIComponent(firmId)}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
    return request('get_catalog', { query: qStr });
  },

  updateLocation: async (workerId, firmId, coords, status = 'NA_TERENU', orderId = null) => {
    return request('update_location', {
      method: 'POST',
      body: {
        majstor_id: workerId,
        firma_id: firmId,
        gpsX: coords.latitude || coords.lat,
        gpsY: coords.longitude || coords.lng,
        brzina: coords.speed || 0,
        kurs: coords.heading || 0,
        baterija: coords.battery || null,
        status,
        nalog_id: orderId
      }
    });
  },

  getDispatcherDashboard: async (firmId, date = '') => {
    const qStr = `firma_id=${encodeURIComponent(firmId)}${date ? `&datum=${encodeURIComponent(date)}` : ''}`;
    return request('get_dispatcher_dashboard', { query: qStr });
  }
};
