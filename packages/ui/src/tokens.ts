/** Define the shared visual vocabulary for native and web components. */
export const tokens = {
  color: {
    canvas: "#F7F8FA",
    surface: "#FFFFFF",
    ink: "#192C29",
    muted: "#7A8583",
    subtle: "#A3ACAA",
    line: "#E8ECEA",
    soft: "#F1F4F2",
    brand: "#245C4B",
    brandHover: "#1B493B",
    brandSoft: "#EAF2ED",
    orange: "#ED7B4A",
    orangeSoft: "#FFF0E8",
    success: "#24815A",
    successSoft: "#EAF6EE",
    warning: "#A76C12",
    warningSoft: "#FFF5DF",
    danger: "#C64E4E",
    dangerSoft: "#FEF0EF",
    info: "#4479B1",
    infoSoft: "#EDF3FC",
    violet: "#7B62A8",
    violetSoft: "#F3EFFA",
    white: "#FFFFFF",
  },
  space: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40, section: 48 },
  radius: { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 },
  font: {
    regular: "DMSans_400Regular",
    medium: "DMSans_500Medium",
    semibold: "DMSans_600SemiBold",
    bold: "DMSans_700Bold",
    display: "DMSerifDisplay_400Regular",
  },
  type: { micro: 11, caption: 12, body: 14, subtitle: 16, title: 20, heading: 28, display: 38 },
  // AppShell and menu-card sizing must use the same dimensions to avoid viewport overflow.
  layout: {
    sidebar: 234,
    maxWidth: 1600,
    gutter: 32,
    mobileGutter: 18,
    breakpoint: 1000,
    cardMin: 250,
  },
  shadow: {
    card: "0px 2px 8px rgba(22, 44, 36, 0.025)",
    floating: "0px 16px 64px rgba(18, 41, 32, 0.16)",
  },
  elevation: { card: 1, floating: 12 },
} as const;

/** Name semantic feedback states independently of their concrete palette values. */
export type Tone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "orange";
/** Pair foreground and background colors for badges and contextual feedback. */
export const tones: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: tokens.color.muted, bg: tokens.color.soft },
  brand: { fg: tokens.color.brand, bg: tokens.color.brandSoft },
  success: { fg: tokens.color.success, bg: tokens.color.successSoft },
  warning: { fg: tokens.color.warning, bg: tokens.color.warningSoft },
  danger: { fg: tokens.color.danger, bg: tokens.color.dangerSoft },
  info: { fg: tokens.color.info, bg: tokens.color.infoSoft },
  violet: { fg: tokens.color.violet, bg: tokens.color.violetSoft },
  orange: { fg: tokens.color.orange, bg: tokens.color.orangeSoft },
};
