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
import { colors } from './src/theme/colors';

function MainNavigator() {
  const { user, loading, isDispatcher, isOwner, isSuperAdmin } = useAuth();
  const [currentView, setCurrentView] = useState('orders'); // 'orders' | 'detail' | 'dispatcher' | 'superadmin'
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // Automatski podesi početni ekran prema ulozi
  useEffect(() => {
    if (user) {
      if (isSuperAdmin) {
        setCurrentView('superadmin');
      } else if (isDispatcher || isOwner) {
        setCurrentView('dispatcher');
      } else {
        setCurrentView('orders');
      }
    }
  }, [user?.id, isSuperAdmin, isDispatcher, isOwner]);

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

  // Ako je izabran SuperAdmin ekran
  if (currentView === 'superadmin') {
    return (
      <SuperAdminScreen
        onOpenDispatcher={() => setCurrentView('dispatcher')}
      />
    );
  }

  // Ako je izabran detalj naloga
  if (currentView === 'detail' && selectedOrderId) {
    return (
      <OrderDetailScreen
        orderId={selectedOrderId}
        onBack={() => {
          setSelectedOrderId(null);
          setCurrentView(isDispatcher || isOwner ? 'dispatcher' : 'orders');
        }}
      />
    );
  }

  // Ako je izabran dispečerski centar
  if (currentView === 'dispatcher') {
    return (
      <DispatcherScreen
        onBackToWorker={() => setCurrentView(isSuperAdmin ? 'superadmin' : 'orders')}
        onSelectOrder={(orderId) => {
          setSelectedOrderId(orderId);
          setCurrentView('detail');
        }}
      />
    );
  }

  // Standardni prikaz: Lista naloga za majstora
  return (
    <WorkerOrdersScreen
      onSelectOrder={(orderId) => {
        setSelectedOrderId(orderId);
        setCurrentView('detail');
      }}
      onOpenDispatcher={() => setCurrentView(isSuperAdmin ? 'superadmin' : 'dispatcher')}
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
