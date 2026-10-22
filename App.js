import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import WorkerOrdersScreen from './src/screens/WorkerOrdersScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import DispatcherScreen from './src/screens/DispatcherScreen';
import { colors } from './src/theme/colors';

function MainNavigator() {
  const { user, loading, isDispatcher, isOwner } = useAuth();
  const [currentView, setCurrentView] = useState('orders'); // 'orders' | 'detail' | 'dispatcher'
  const [selectedOrderId, setSelectedOrderId] = useState(null);

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

  // Ako je izabran detalj naloga
  if (currentView === 'detail' && selectedOrderId) {
    return (
      <OrderDetailScreen
        orderId={selectedOrderId}
        onBack={() => {
          setSelectedOrderId(null);
          setCurrentView('orders');
        }}
      />
    );
  }

  // Ako je izabran dispečerski centar
  if (currentView === 'dispatcher') {
    return (
      <DispatcherScreen
        onBackToWorker={() => setCurrentView('orders')}
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
      onOpenDispatcher={() => setCurrentView('dispatcher')}
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
