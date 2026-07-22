import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../constants/theme';

// Small logo-free brand lockup used at the top of auth/onboarding screens:
// a lime "W" chip + the "washly" wordmark in Poppins.
export function Brandmark() {
  return (
    <View style={styles.row}>
      <View style={styles.chip}>
        <Text style={styles.chipLetter}>W</Text>
      </View>
      <Text style={styles.wordmark}>washly</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.electricLime,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chipLetter: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.inkOnLime,
  },
  wordmark: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.appBlue,
    letterSpacing: 0.2,
  },
});
