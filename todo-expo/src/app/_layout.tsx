import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/auth';
import { TodoProvider, useTodos } from '@/todos';

export default function RootLayout() {
  return (
    <AuthProvider>
      <TodoProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </TodoProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { user, isLoading: authLoading, error: authError, clearError: clearAuthError } = useAuth();
  const {
    isLoading: todosLoading,
    error: todosError,
    clearError: clearTodosError,
  } = useTodos();

  if (authLoading || todosLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isLoggedIn = user !== null;
  const error = todosError ?? authError;

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: '#f1f5f9' } }}>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={isLoggedIn} redirectTo="/login">
          <Stack.Screen name="index" options={{ title: 'Todos' }} />
          <Stack.Screen name="todo/new" options={{ title: 'New todo', presentation: 'modal' }} />
          <Stack.Screen name="todo/[id]/index" options={{ title: 'Todo' }} />
          <Stack.Screen name="todo/[id]/edit" options={{ title: 'Edit todo' }} />
        </Stack.Protected>
      </Stack>
      {error ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            clearTodosError();
            clearAuthError();
          }}
          style={styles.errorBanner}
        >
          <Text style={styles.errorText}>{error}  (Tap to dismiss)</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  errorBanner: { backgroundColor: '#fee2e2', padding: 12 },
  errorText: { color: '#991b1b', textAlign: 'center' },
});
