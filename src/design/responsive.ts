import { useMemo } from 'react';
import {
  Platform,
  useWindowDimensions,
  type ScaledSize,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Design breakpoints (aligned with DesignSystem) */
export const BREAKPOINTS = {
  xs: 320,
  sm: 360,
  md: 390,
  lg: 430,
  tablet: 768,
  largeTablet: 1024,
  desktop: 1280,
} as const;

/** Minimum touch targets per platform HIG / Material */
export const MIN_TOUCH = Platform.select({ ios: 44, android: 48, default: 44 })!;

const BASE_WIDTH = 390;

/**
 * Moderate scale: grows/shrinks with width but clamps so tablets
 * don't balloon type/spacing and SE doesn't crush it.
 */
export function moderateScale(size: number, factor = 0.35, width?: number): number {
  const w = width ?? BASE_WIDTH;
  const scale = w / BASE_WIDTH;
  const value = size + (size * scale - size) * factor;
  return Math.round(value * 10) / 10;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type ResponsiveInfo = {
  width: number;
  height: number;
  isLandscape: boolean;
  isSmallPhone: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  contentPad: number;
  maxContentWidth: number;
  ms: (size: number, factor?: number) => number;
  fitWidth: (desired: number, margin?: number) => number;
};

export function getResponsiveInfo(window: ScaledSize): ResponsiveInfo {
  const { width, height } = window;
  const short = Math.min(width, height);
  const isLandscape = width > height;
  const isTablet = short >= BREAKPOINTS.tablet;
  const isLargeTablet = short >= BREAKPOINTS.largeTablet;
  const isSmallPhone = short < BREAKPOINTS.sm;
  const contentPad = isLargeTablet ? 32 : isTablet ? 24 : isSmallPhone ? 12 : 16;
  const maxContentWidth = isLargeTablet ? 720 : isTablet ? 560 : width;

  return {
    width,
    height,
    isLandscape,
    isSmallPhone,
    isPhone: !isTablet,
    isTablet,
    isLargeTablet,
    contentPad,
    maxContentWidth,
    ms: (size, factor = 0.35) => moderateScale(size, factor, width),
    fitWidth: (desired, margin = 48) => Math.min(desired, Math.max(200, width - margin)),
  };
}

export function useResponsive(): ResponsiveInfo {
  const window = useWindowDimensions();
  return useMemo(() => getResponsiveInfo(window), [window.width, window.height]);
}

export function useHeaderSafePadding(extra = 12): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 8) + extra;
}

export function useBottomSafePadding(extra = 16): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8) + extra;
}

export function useScreenSafePadding() {
  const insets = useSafeAreaInsets();
  const headerPadTop = useHeaderSafePadding(12);
  const bottomPad = useBottomSafePadding(16);
  return {
    ...insets,
    headerPadTop,
    bottomPad,
    screenPadH: Math.max(insets.left, insets.right, 0) + 16,
  };
}

export function useSidebarWidth(max = 360, ratio = 0.88): number {
  const { width } = useWindowDimensions();
  return useMemo(() => Math.min(width * ratio, max), [width, max, ratio]);
}

export function useCardWidth(gutter = 40): number {
  const { width } = useWindowDimensions();
  return useMemo(() => Math.max(260, width - gutter), [width, gutter]);
}
