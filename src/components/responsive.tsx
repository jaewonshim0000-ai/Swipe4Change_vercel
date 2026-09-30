import React from 'react';
import { Platform, View, ViewStyle, useWindowDimensions } from 'react-native';

/** Web adapts to its viewport; native keeps the established mobile layout. */
export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  return { wide: Platform.OS === 'web' && width >= 900 };
}

export const webLayout = { readingWidth: 760, browseWidth: 1200 };

/** Equal-width discovery cards, preserving their order on narrow screens. */
export function ResponsiveGrid({ children }: { children: React.ReactNode }) {
  const { wide } = useResponsiveLayout();
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: 12 }}>
      {React.Children.toArray(children).map((child, index) => (
        <View
          key={React.isValidElement(child) ? (child.key ?? index) : index}
          style={{ width: wide ? '49%' : '100%', flexGrow: wide ? 1 : 0, minWidth: 0 }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

export const readingFrame: ViewStyle = {
  width: '100%',
  alignSelf: 'center',
  maxWidth: Platform.OS === 'web' ? webLayout.readingWidth : undefined,
};
