import { Dispatch, SetStateAction, useState } from 'react';
import { GestureResponderEvent, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SignaturePoint } from '../domain/signature-record';
import { colors, fonts } from './theme';

export function SignaturePad({
  value,
  onChange,
  readonly = false,
}: {
  value: SignaturePoint[];
  /** A state setter: moves arrive faster than renders, so each point appends to the latest list. */
  onChange: Dispatch<SetStateAction<SignaturePoint[]>>;
  readonly?: boolean;
}) {
  const [size, setSize] = useState({ width: 300, height: 150 });
  function add(event: GestureResponderEvent, start: boolean) {
    if (readonly) return;
    const { locationX, locationY } = event.nativeEvent;
    const next = {
      x: Math.max(0, Math.min(1, locationX / size.width)),
      y: Math.max(0, Math.min(1, locationY / size.height)),
      start,
    };
    onChange((points) => (points.length >= 3000 ? points : [...points, next]));
  }
  const d = value
    .map(
      (p, i) =>
        `${i === 0 || p.start ? 'M' : 'L'}${(p.x * size.width).toFixed(1)} ${(p.y * size.height).toFixed(1)}`,
    )
    .join(' ');
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 20,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.radio,
        overflow: 'hidden',
      }}
    >
      <View
        accessibilityLabel={
          readonly
            ? 'Your saved handwritten signature'
            : 'Signature drawing area. Draw with a finger, stylus, or mouse.'
        }
        onLayout={(e) => setSize(e.nativeEvent.layout)}
        onStartShouldSetResponder={() => !readonly}
        onMoveShouldSetResponder={() => !readonly}
        // The pad sits inside the signing sheet's ScrollView; a stroke must not turn into a scroll.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => add(e, true)}
        onResponderMove={(e) => add(e, false)}
        style={{ height: 150 }}
      >
        {!value.length && !readonly && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.italic, fontSize: 20, color: '#A9AE9F' }}>
              Draw your signature here
            </Text>
          </View>
        )}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 18,
            right: 18,
            bottom: 30,
            height: 1,
            backgroundColor: colors.line,
          }}
        />
        <Svg
          pointerEvents="none"
          width={size.width}
          height={size.height}
          style={{ position: 'absolute' }}
        >
          {!!d && (
            <Path
              d={d}
              stroke={colors.dark}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </Svg>
      </View>
      {!readonly && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear signature"
          onPress={() => onChange([])}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: colors.field,
            borderRadius: 999,
            paddingVertical: 5,
            paddingHorizontal: 10,
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.muted }}>
            Clear
          </Text>
        </Pressable>
      )}
    </View>
  );
}
