import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radii, spacing } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'dangerGhost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The one accent color (Electric Lime) is reserved for `primary` -- the
// single main call-to-action per screen. `secondary` is an outlined App
// Blue action, `ghost`/`dangerGhost` are text-only links.
export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  const spinnerColor = variant === 'primary' ? colors.inkOnLime : colors.appBlue;

  return (
    <TouchableOpacity
      style={[styles.base, VARIANT_STYLES[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={[styles.label, VARIANT_LABEL_STYLES[variant]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
});

const VARIANT_STYLES: Record<Variant, StyleProp<ViewStyle>> = {
  primary: { backgroundColor: colors.electricLime },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.appBlue,
    paddingVertical: 14.5,
  },
  ghost: { backgroundColor: 'transparent', paddingVertical: spacing.sm },
  dangerGhost: { backgroundColor: 'transparent', paddingVertical: spacing.sm },
};

const VARIANT_LABEL_STYLES: Record<Variant, StyleProp<TextStyle>> = {
  primary: { color: colors.inkOnLime },
  secondary: { color: colors.appBlue },
  ghost: { color: colors.appBlue },
  dangerGhost: { color: colors.danger },
};
