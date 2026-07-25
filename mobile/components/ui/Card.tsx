import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadow, spacing } from '../../constants/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: 'surface' | 'lime' | 'blue';
}

// Per the design reference: only plain white cards carry the drop shadow --
// tinted (blue/lime) cards are flat with just their border, never both.
const TINT_STYLES = {
  surface: { backgroundColor: colors.surface, ...shadow.card },
  lime: { backgroundColor: '#F5FEDC', borderWidth: 1, borderColor: colors.electricLimeDark },
  blue: { backgroundColor: colors.appBlueTint, borderWidth: 1, borderColor: colors.appBlue },
};

export function Card({ children, style, tint = 'surface' }: CardProps) {
  return <View style={[styles.card, TINT_STYLES[tint], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.xxl,
    marginBottom: spacing.xl,
  },
});
