import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../constants/theme';

export type PillTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE_STYLES: Record<PillTone, { bg: string; fg: string }> = {
  success: { bg: colors.successTint, fg: colors.success },
  warning: { bg: colors.warningTint, fg: colors.warning },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  neutral: { bg: colors.surfaceMuted, fg: colors.neutral },
};

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const { bg, fg } = TONE_STYLES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
});
