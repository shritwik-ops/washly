import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../constants/theme';

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.boxChecked]}>
      {checked ? <Text style={styles.check}>✓</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: radii.sm - 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.appBlue,
    borderColor: colors.appBlue,
  },
  check: {
    color: colors.surface,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
});
