import { StyleSheet, TextInput, View, Text, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, fonts, radii, spacing } from '../../constants/theme';

interface TextFieldProps extends TextInputProps {
  prefix?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

// Shared rounded input used across auth/onboarding forms. `prefix` renders
// a fixed leading label inside the field (the "+91" country code).
// `containerStyle` targets the outer row (for margin); `style` still
// targets the TextInput itself, matching normal TextInput usage.
export function TextField({ prefix, style, containerStyle, ...inputProps }: TextFieldProps) {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.inkMuted}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  prefix: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.ink,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 15,
  },
});
