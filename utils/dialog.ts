import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 *
 * On native (iOS/Android), uses Alert.alert with Cancel/Confirm buttons.
 * On web, uses window.confirm because Alert.alert is a NO-OP on react-native-web.
 *
 * Returns a Promise<boolean> that resolves to true if the user confirmed,
 * false if they cancelled.
 */
export function confirmDialog(
  title: string,
  message: string,
  opts?: { confirmText?: string; cancelText?: string; destructive?: boolean }
): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmText = opts?.confirmText || 'OK';
    const cancelText = opts?.cancelText || 'Annuler';

    if (Platform.OS === 'web') {
      // window.confirm is synchronous but we wrap it in a Promise for a uniform API.
      // We include the title in the body because window.confirm only shows one line of text well.
      const ok = typeof window !== 'undefined'
        ? window.confirm(`${title}\n\n${message}`)
        : false;
      resolve(ok);
      return;
    }

    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: opts?.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * Cross-platform alert dialog (one button only).
 *
 * On native, uses Alert.alert. On web, uses window.alert.
 */
export function alertDialog(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.alert(`${title}\n\n${message}`);
      }
      resolve();
      return;
    }
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });
}
