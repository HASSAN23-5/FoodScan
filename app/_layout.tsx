import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[barcode]" options={{ headerShown: false }} />
        <Stack.Screen name="ai-coach" options={{ headerShown: false }} />
        <Stack.Screen name="compare" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
