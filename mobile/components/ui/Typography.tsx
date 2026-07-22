import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, fonts } from '../../constants/theme';

interface TextProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}

// Poppins Bold display heading -- screen titles, the wordmark, big numbers.
export function Heading({ children, style, size = 'lg' }: TextProps & { size?: 'md' | 'lg' | 'xl' }) {
  const fontSize = size === 'xl' ? 30 : size === 'lg' ? 25 : 20;
  return <Text style={[{ fontFamily: fonts.heading, fontSize, color: colors.ink }, style]}>{children}</Text>;
}

// Inter body text -- everything that isn't a heading or a button label.
export function Body({
  children,
  style,
  muted = false,
}: TextProps & { muted?: boolean }) {
  return (
    <Text
      style={[
        { fontFamily: fonts.body, fontSize: 15, color: muted ? colors.inkMuted : colors.ink, lineHeight: 21 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Label({ children, style }: TextProps) {
  return (
    <Text
      style={[
        {
          fontFamily: fonts.bodySemiBold,
          fontSize: 12,
          color: colors.inkMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function ErrorText({ children, style }: TextProps) {
  return (
    <Text style={[{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.danger }, style]}>
      {children}
    </Text>
  );
}
