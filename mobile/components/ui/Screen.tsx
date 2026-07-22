import type { ReactElement, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { colors, spacing } from '../../constants/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  center?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
}

// Every screen's outer shell: warm off-white background, consistent
// padding, keyboard-avoiding on iOS. `center` vertically centers content
// for short auth-style forms; `scroll` is for content-heavy screens (home).
export function Screen({ children, scroll = false, center = false, refreshControl }: ScreenProps) {
  const Container = scroll ? ScrollView : View;
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Container
        style={styles.fill}
        contentContainerStyle={[styles.content, center && styles.centered]}
        {...(scroll ? { refreshControl, keyboardShouldPersistTaps: 'handled' as const } : {})}
      >
        {children}
      </Container>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: 72,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  centered: {
    justifyContent: 'center',
  },
});
