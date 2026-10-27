import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, initApiUrl } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initApiUrl();
        const savedUser = await AsyncStorage.getItem('@majstornalog:user');
        const savedToken = await AsyncStorage.getItem('@majstornalog:token');
        if (savedUser && savedToken) {
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
        }
      } catch (e) {
        console.warn('Greška pri učitavanju sesije:', e);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    setToken(data.token);
    await AsyncStorage.setItem('@majstornalog:user', JSON.stringify(data.user));
    await AsyncStorage.setItem('@majstornalog:token', data.token);
    return data.user;
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem('@majstornalog:user');
    await AsyncStorage.removeItem('@majstornalog:token');
  };

  const isWorker = user?.rola === 'majstor';
  const isDispatcher = user?.rola === 'dispecer';
  const isOwner = user?.rola === 'vlasnik' || user?.rola === 'admin' || Number(user?.rola_id) === 2;
  const isAdmin = isOwner;
  const isSuperAdmin = user?.rola === 'superadmin' || Number(user?.rola_id) === 1;
  const isRegularUser = user?.rola === 'korisnik' || Number(user?.rola_id) === 3;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isWorker,
        isDispatcher,
        isOwner,
        isSuperAdmin,
        isAdmin,
        isRegularUser,
        firmId: user?.firma_id || 1
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
