import type { ReactElement, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { colors, spacing } from '../../constants/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  center?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  // Overrides the default top padding. Per the design reference: centered
  // auth/onboarding screens have no top inset (content is vertically
  // centered from the very top of the safe area), title-header screens
  // (home, book, checklist, id-upload, college) use 72, and "← Back"
  // account screens (wallet, wash-history, referral, notifications,
  // support/*) use 64 -- there's less empty space above a back-link than
  // above a standalone title.
  insetTop?: number;
}

// Every screen's outer shell: warm off-white background, consistent
// padding, keyboard-avoiding on iOS. `center` vertically centers content
// for short auth-style forms; `scroll` is for content-heavy screens (home).
export function Screen({ children, scroll = false, center = false, refreshControl, insetTop }: ScreenProps) {
  const Container = scroll ? ScrollView : View;
  const paddingTop = insetTop ?? (center ? 0 : 72);
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Container
        style={styles.fill}
        contentContainerStyle={[styles.content, { paddingTop }, center && styles.centered]}
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
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  centered: {
    justifyContent: 'center',
  },
});
