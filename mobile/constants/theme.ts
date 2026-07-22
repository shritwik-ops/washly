// Washly brand identity. Every screen pulls colors/type/spacing from here --
// no hardcoded hex values or font sizes in screen files.

export const colors = {
  // Brand
  appBlue: '#2E4BFF',
  appBlueDark: '#1E35C9',
  appBlueTint: '#E7EBFF',
  electricLime: '#D6FF3F',
  electricLimeDark: '#B8E01F',

  // Surfaces
  background: '#FBF6EF', // warm off-white
  surface: '#FFFFFF',
  surfaceMuted: '#F4EEE3',
  border: '#EBE3D4',

  // Text
  ink: '#171923', // near-black warm charcoal
  inkMuted: '#7C7568',
  inkOnLime: '#14210A',
  inkOnBlue: '#FFFFFF',

  // Semantic
  success: '#1FAE6A',
  successTint: '#E4F8ED',
  warning: '#F2A93B',
  warningTint: '#FDF1DE',
  danger: '#E5484D',
  dangerTint: '#FBE6E6',
  neutral: '#9A9284',
} as const;

export const fonts = {
  heading: 'Poppins_700Bold',
  headingSemiBold: 'Poppins_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#3A2F1D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
} as const;
