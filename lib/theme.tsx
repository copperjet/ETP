import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, ColorScheme } from '../constants/Colors';

interface BrandColors {
  primary: string;
  secondary: string;
}

type BaseColors = Record<keyof typeof Colors.light, string>;

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: BaseColors & { brand: BrandColors };
}

const DEFAULT_BRAND: BrandColors = { primary: '#1B2A4A', secondary: '#E8A020' };

const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'light',
  colors: { ...Colors.light, brand: DEFAULT_BRAND },
});

export function ThemeProvider({
  children,
  brand = DEFAULT_BRAND,
}: {
  children: React.ReactNode;
  brand?: BrandColors;
}) {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: { ...Colors[scheme], brand },
    }),
    [scheme, brand]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
