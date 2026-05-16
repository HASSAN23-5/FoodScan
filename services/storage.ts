import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'foodscan_access_token';
const REFRESH_KEY = 'foodscan_refresh_token';
const USER_KEY = 'foodscan_user';

export async function saveToken(accessToken: string, refreshToken?: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

export async function getToken(): Promise<string | null> {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return await AsyncStorage.getItem(REFRESH_KEY);
}

export async function removeToken(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
}

export async function saveUser(user: object): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<object | null> {
  const data = await AsyncStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}
