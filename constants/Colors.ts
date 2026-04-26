export const Colors = {
  light: {
    background: '#F4F6F4',
    surface: '#FFFFFF',
    surfaceSecondary: '#EEF2EE',
    surfaceTertiary: '#E6EDE6',
    border: '#DCE5DC',
    borderLight: '#EEF2EE',
    textPrimary: '#0D1F0F',
    textSecondary: '#2D4A30',
    textMuted: '#7A9B7E',
    textInverse: '#FFFFFF',
    icon: '#5A7D5E',
  },
  dark: {
    background: '#0F1F15',
    surface: '#1A2F22',
    surfaceSecondary: '#243D2E',
    surfaceTertiary: '#2E4B3A',
    border: '#3A5A47',
    borderLight: '#2E4B3A',
    textPrimary: '#F0F7F4',
    textSecondary: '#C8E0CD',
    textMuted: '#7BA87F',
    textInverse: '#0F1F15',
    icon: '#8FC494',
  },
  semantic: {
    success: '#16A34A',
    successLight: '#DCFCE7',
    successDark: '#14532D',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    warningDark: '#78350F',
    error: '#DC2626',
    errorLight: '#FEE2E2',
    errorDark: '#7F1D1D',
    info: '#2563EB',
    infoLight: '#DBEAFE',
    infoDark: '#1E3A8A',
  },
  attendance: {
    present: '#16A34A',
    presentBg: { light: '#DCFCE7', dark: '#14532D' },
    late: '#D97706',
    lateBg: { light: '#FEF3C7', dark: '#78350F' },
    absent: '#DC2626',
    absentBg: { light: '#FEE2E2', dark: '#7F1D1D' },
    ap: '#2563EB',
    apBg: { light: '#DBEAFE', dark: '#1E3A8A' },
    sick: '#7C3AED',
    sickBg: { light: '#EDE9FE', dark: '#2E1065' },
    unmarked: '#6B7280',
    unmarkedBg: { light: '#F3F4F6', dark: '#374151' },
  },
} as const;

export type ColorScheme = 'light' | 'dark';
export type AttendanceStatusKey = 'present' | 'late' | 'absent' | 'ap' | 'sick' | 'unmarked';

export function resolveAttBg(status: AttendanceStatusKey, scheme: ColorScheme): string {
  if (!status) return Colors.attendance.unmarkedBg[scheme];
  const bg = Colors.attendance[`${status}Bg` as keyof typeof Colors.attendance] as any;
  if (!bg) return Colors.attendance.unmarkedBg[scheme];
  return typeof bg === 'string' ? bg : bg[scheme];
}

export function resolveAttColor(status: AttendanceStatusKey): string {
  if (!status) return Colors.attendance.unmarked;
  const color = Colors.attendance[status] as string;
  return color ?? Colors.attendance.unmarked;
}
