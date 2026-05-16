import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface Props {
  grade: string;
  size?: 'small' | 'medium' | 'large';
}

export default function NutriScore({ grade, size = 'medium' }: Props) {
  const g = grade?.toUpperCase() || '?';
  const color = Colors.nutriScore[g] || '#999';
  const textColor = g === 'C' ? Colors.foreground : Colors.white;
  const dim = size === 'small' ? 28 : size === 'large' ? 48 : 36;
  const fontSize = size === 'small' ? 12 : size === 'large' ? 22 : 16;

  return (
    <View style={[styles.badge, { backgroundColor: color, width: dim, height: dim, borderRadius: dim * 0.25 }]}>
      <Text style={[styles.text, { color: textColor, fontSize }]}>{g}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
});
