export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F9FAFB',
    surfaceSecondary: '#F3F4F6',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    textPrimary: '#1B2A4A',
    textSecondary: '#374151',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',
    icon: '#6B7280',
  },
  dark: {
    background: '#111827',
    surface: '#1F2937',
    surfaceSecondary: '#374151',
    border: '#374151',
    borderLight: '#2D3748',
    textPrimary: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textMuted: '#6B7280',
    textInverse: '#111827',
    icon: '#9CA3AF',
  },
  semantic: {
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
  },
  attendance: {
    present: '#10B981',
    presentBg: { light: '#D1FAE5', dark: '#064E3B' },
    late: '#F59E0B',
    lateBg: { light: '#FEF3C7', dark: '#451A03' },
    absent: '#EF4444',
    absentBg: { light: '#FEE2E2', dark: '#450A0A' },
    ap: '#3B82F6',
    apBg: { light: '#DBEAFE', dark: '#1E3A5F' },
    sick: '#8B5CF6',
    sickBg: { light: '#EDE9FE', dark: '#2E1065' },
    unmarked: '#9CA3AF',
    unmarkedBg: { light: '#F3F4F6', dark: '#374151' },
  },
} as const;

export type ColorScheme = 'light' | 'dark';

export type AttendanceStatusKey = 'present' | 'late' | 'absent' | 'ap' | 'sick' | 'unmarked';

export function getAttendanceBg(status: AttendanceStatusKey, scheme: ColorScheme): string {
  return Colors.attendance[`${status}Bg` as keyof typeof Colors.attendance] as any;
}

export function resolveAttBg(status: AttendanceStatusKey, scheme: ColorScheme): string {
  const bg = Colors.attendance[`${status}Bg` as keyof typeof Colors.attendance] as any;
  return typeof bg === 'string' ? bg : bg[scheme];
}

export function resolveAttColor(status: AttendanceStatusKey): string {
  return Colors.attendance[status] as string;
}
