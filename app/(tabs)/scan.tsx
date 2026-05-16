import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const router = useRouter();

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    router.push(`/product/${result.data}`);
    // Reset after navigation
    setTimeout(() => setScanned(false), 2000);
  };

  const handleManualSubmit = () => {
    const code = manualBarcode.trim();
    if (code.length > 0) {
      router.push(`/product/${code}`);
      setManualBarcode('');
    }
  };

  // Manual entry mode
  if (manualMode) {
    return (
      <SafeAreaView style={styles.manualContainer}>
        <View style={styles.manualHeader}>
          <TouchableOpacity onPress={() => setManualMode(false)} style={styles.headerBtn}>
            <Ionicons name="camera" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saisie manuelle</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.manualContent}>
          <View style={styles.manualCard}>
            <Text style={styles.manualTitle}>Entrez le code-barres</Text>
            <TextInput
              style={styles.manualInput}
              placeholder="Ex: 3017620422003"
              placeholderTextColor={Colors.mutedForeground}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleManualSubmit}
            />
            <TouchableOpacity
              style={[styles.manualSubmitBtn, !manualBarcode.trim() && { opacity: 0.5 }]}
              onPress={handleManualSubmit}
              disabled={!manualBarcode.trim()}
            >
              <Text style={styles.manualSubmitText}>Rechercher</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomHint}>
          <Text style={styles.hintText}>Entrez le code-barres du produit</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Permission not granted
  if (!permission) {
    return <View style={styles.cameraContainer} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <View style={styles.permissionContent}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Accès caméra requis</Text>
          <Text style={styles.permissionText}>
            FoodScan a besoin d'accéder à votre caméra pour scanner les codes-barres des produits.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Autoriser la caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualToggle} onPress={() => setManualMode(true)}>
            <Ionicons name="keypad-outline" size={18} color={Colors.white} />
            <Text style={styles.manualToggleText}>Saisie manuelle</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Camera view
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay */}
      <SafeAreaView style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scanner</Text>
          <View style={styles.headerBtn}>
            <Ionicons name="flashlight-outline" size={24} color={Colors.white} />
          </View>
        </View>

        {/* Scan frame */}
        <View style={styles.frameContainer}>
          <View style={styles.scanFrame}>
            {/* Corner decorations */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Scan line */}
            <View style={styles.scanLine} />
          </View>
        </View>

        {/* Bottom */}
        <View style={styles.bottomBar}>
          <Text style={styles.hintText}>Placez le code-barres dans le cadre</Text>
          <TouchableOpacity style={styles.manualToggle} onPress={() => setManualMode(true)}>
            <Ionicons name="keypad-outline" size={18} color={Colors.white} />
            <Text style={styles.manualToggleText}>Saisie manuelle</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8,
  },
  headerBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.white },
  frameContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 280, height: 180, borderWidth: 2, borderColor: Colors.primary,
    borderRadius: 16, position: 'relative',
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: Colors.accent, borderWidth: 3 },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  scanLine: {
    position: 'absolute', top: '50%', left: 8, right: 8,
    height: 2, backgroundColor: Colors.accent, opacity: 0.7, borderRadius: 1,
  },
  bottomBar: { alignItems: 'center', paddingBottom: 32, gap: 16 },
  bottomHint: { alignItems: 'center', paddingBottom: 40 },
  hintText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  manualToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
  },
  manualToggleText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
  // Permission screen
  permissionContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permissionIcon: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  permissionTitle: { fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  permissionText: { fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  permissionBtn: {
    backgroundColor: Colors.primary, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 14, marginBottom: 16,
  },
  permissionBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  // Manual mode
  manualContainer: { flex: 1, backgroundColor: '#000' },
  manualHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  manualContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  manualCard: {
    backgroundColor: Colors.card, borderRadius: 24, padding: 24,
  },
  manualTitle: { fontSize: 20, fontWeight: '600', color: Colors.foreground, textAlign: 'center', marginBottom: 16 },
  manualInput: {
    height: 52, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    fontSize: 18, textAlign: 'center', color: Colors.foreground, backgroundColor: Colors.muted, marginBottom: 16,
  },
  manualSubmitBtn: {
    height: 50, borderRadius: 25, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  manualSubmitText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
