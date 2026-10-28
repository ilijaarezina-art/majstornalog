import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import WorkerOrdersScreen from './src/screens/WorkerOrdersScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import DispatcherScreen from './src/screens/DispatcherScreen';
import SuperAdminScreen from './src/screens/SuperAdminScreen';
import { api } from './src/services/api';
import { colors } from './src/theme/colors';

function MainNavigator() {
  const { user, loading, isDispatcher, isOwner, isSuperAdmin, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState('orders'); // 'orders' | 'detail' | 'dispatcher' | 'superadmin'
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const isManagement = isSuperAdmin || isDispatcher || isOwner || isAdmin;

    // Automatski podesi početni ekran prema ulozi (potpuno odvojene forme za admina/dispečera i majstora)
  useEffect(() => {
    if (user) {
      if (isSuperAdmin) {
        setCurrentView('superadmin');
      } else if (isManagement) {
        setCurrentView('dispatcher');
      } else {
        setCurrentView('orders');
      }
    }
  }, [user?.id, isSuperAdmin, isManagement]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // 1. SuperAdmin forma (upravljanje firmama i sistemom)
  if (currentView === 'superadmin') {
    return (
      <SuperAdminScreen
        onOpenDispatcher={() => setCurrentView('dispatcher')}
      />
    );
  }

  // 2. Detaljan pregled radnog naloga
  if (currentView === 'detail' && selectedOrderId) {
    return (
      <OrderDetailScreen
        orderId={selectedOrderId}
        onBack={() => {
          setSelectedOrderId(null);
          setCurrentView(isManagement ? 'dispatcher' : 'orders');
        }}
      />
    );
  }

  // 3. Dispečerska / Admin forma (Prikaz mape terena sa majstorima i centralnih naloga)
  if (currentView === 'dispatcher' || isManagement) {
    return (
      <DispatcherScreen
        onBackToWorker={null}
        onSelectOrder={(orderId) => {
          setSelectedOrderId(orderId);
          setCurrentView('detail');
        }}
      />
    );
  }

  // 4. Majstorska forma (Isključivo dodeljeni nalozi majstora sa mapom dolaznih lokacija za taj dan)
  return (
    <WorkerOrdersScreen
      onSelectOrder={(orderId) => {
        setSelectedOrderId(orderId);
        setCurrentView('detail');
      }}
      onOpenDispatcher={null}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" backgroundColor={colors.slate900} />
          <MainNavigator />
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate900,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate900,
  },
});
