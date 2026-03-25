import { StyleSheet } from "react-native";

/* =====================================================
   TYPOGRAPHY (YOUR ORIGINAL FONT KEPT)
===================================================== */

export const typography = {
  fontFamilyRegular: "Montserrat_400Regular",
  fontFamilyMedium: "Montserrat_500Medium",
  fontFamilySemiBold: "Montserrat_600SemiBold",
  fontFamilyBold: "Montserrat_700Bold",

  display: { fontSize: 34, lineHeight: 40 },
  heading1: { fontSize: 28, lineHeight: 34 },
  heading2: { fontSize: 22, lineHeight: 28 },
  heading3: { fontSize: 18, lineHeight: 24 },

  bodyLarge: { fontSize: 16, lineHeight: 24 },
  body: { fontSize: 14, lineHeight: 20 },

  caption: { fontSize: 12, lineHeight: 16 },
};

/* =====================================================
   SPACING
===================================================== */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
};

/* =====================================================
   LAYOUT — screen-level spacing controlled from one place
===================================================== */

export const layout = {
  screenPaddingHorizontal: 10,
};

/* =====================================================
   BRAND — accent colours shared across all screens
===================================================== */

export const brand = {
  gold: 'rgba(212,175,55,0.9)',
  goldBg: 'rgba(212,175,55,0.15)',
};

/* =====================================================
   BORDER RADIUS
===================================================== */

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

/* =====================================================
   SHADOWS (VERCEL STYLE — VERY SUBTLE)
===================================================== */

export const shadows = {
  cardLight: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  cardDark: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};

/* =====================================================
   COMPONENT TOKENS
===================================================== */

export const components = {
  button: {
    height: 55,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.xl,
  },

  input: {
    height: 55,
    borderRadius: radii.xs,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
  },

  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
};

/* =====================================================
   LIGHT THEME (VERCEL STYLE)
===================================================== */

export const lightTheme = {
  mode: "light",

  background: "#ffffff",
  surface: "#fafafa",

  card: "#ffffff",

  text: "#111111",
  subtleText: "#6b7280",

  border: "#e5e7eb",

  primary: "#000000",
  primaryForeground: "#ffffff",

  secondary: "#f4f4f5",

  success: "#22c55e",
  error: "#ef4444",

  inputBackground: "#ffffff",
};

/* =====================================================
   DARK THEME
===================================================== */

export const darkTheme = {
  mode: "dark",

  background: "#000000",
  surface: "#09090b",

  card: "#111111",

  text: "#fafafa",
  subtleText: "#a1a1aa",

  border: "#27272a",

  primary: "#ffffff",
  primaryForeground: "#000000",

  secondary: "#18181b",

  success: "#22c55e",
  error: "#ef4444",

  inputBackground: "#09090b",
};

/* =====================================================
   UI KIT (VERCEL STYLE COMPONENT STYLES)
===================================================== */

export const ui = {
  screen: (theme) => ({
    flex: 1,
    backgroundColor: theme.background,
    padding: spacing.lg,
  }),

  screenAuth: (theme) => ({
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: spacing.xl,
    paddingVertical: 48,
  }),

  screenProfile: (theme) => ({
    flex: 1,
    backgroundColor: theme.background,
    padding: spacing.lg,
    paddingTop: spacing.xl + spacing.lg,
  }),

  card: (theme) => ({
    backgroundColor: theme.card,
    borderRadius: radii.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
  }),

  buttonPrimary: (theme) => ({
    height: components.button.height,
    borderRadius: components.button.borderRadius,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
  }),

  buttonSecondary: (theme) => ({
    height: components.button.height,
    borderRadius: components.button.borderRadius,
    backgroundColor: theme.secondary,
    justifyContent: "center",
    alignItems: "center",
  }),

  buttonOutline: (theme) => ({
    height: components.button.height,
    borderRadius: components.button.borderRadius,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: "center",
    alignItems: "center",
  }),

  buttonTextPrimary: (theme) => ({
    color: theme.primaryForeground,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
  }),

  buttonText: (theme) => ({
    color: theme.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
  }),

  buttonDanger: (theme) => ({
    height: components.button.height,
    borderRadius: components.button.borderRadius,
    backgroundColor: theme.error,
    justifyContent: "center",
    alignItems: "center",
  }),

  buttonDangerText: (theme) => ({
    color: theme.primaryForeground,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
  }),

  input: (theme) => ({
    height: components.button.height,
    borderRadius: components.button.borderRadius,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.inputBackground,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
    color: theme.text,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
  }),

  h1: (theme) => ({
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.heading1.fontSize,
    lineHeight: typography.heading1.lineHeight,
    color: theme.text,
  }),

  h2: (theme) => ({
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.heading2.fontSize,
    lineHeight: typography.heading2.lineHeight,
    color: theme.text,
  }),

  body: (theme) => ({
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: theme.text,
  }),

  caption: (theme) => ({
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.caption.fontSize,
    color: theme.subtleText,
  }),

  link: (theme) => ({
    color: theme.primary,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
  }),

  errorText: (theme) => ({
    color: theme.error,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
  }),

  successText: (theme) => ({
    color: theme.success,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
  }),

  navbar: (theme) => ({
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingHorizontal: spacing.lg,
  }),

  screenHeader: (theme) => ({
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    marginBottom: spacing.lg,
  }),

  screenHeaderTitle: (theme) => ({
    flex: 1,
    textAlign: "center",
    fontSize: typography.bodyLarge.fontSize,
    fontFamily: typography.fontFamilySemiBold,
    color: theme.text,
  }),

  listItem: (theme) => ({
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  }),

  badge: (theme) => ({
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: theme.secondary,
  }),

  badgeText: (theme) => ({
    fontFamily: typography.fontFamilyMedium,
    fontSize: 12,
    color: theme.text,
  }),

  divider: (theme) => ({
    height: 1,
    backgroundColor: theme.border,
  }),

  modalOverlay: () => ({
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  }),

  modalContent: (theme) => ({
    backgroundColor: theme.card,
    borderRadius: radii.lg,
    padding: spacing.xl,
  }),

  toast: (theme) => ({
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: theme.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
  }),

  skeleton: (theme) => ({
    backgroundColor: theme.surface,
    borderRadius: radii.sm,
  }),
};
