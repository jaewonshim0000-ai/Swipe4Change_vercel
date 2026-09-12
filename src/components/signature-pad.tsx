import { useState } from 'react';
import { GestureResponderEvent, Text, View } from 'react-native';
import { SignaturePoint } from '../domain/signatory';
import { Button, colors, styles } from './ui';

export function SignaturePad({
  value,
  onChange,
  readonly = false,
}: {
  value: SignaturePoint[];
  onChange: (value: SignaturePoint[]) => void;
  readonly?: boolean;
}) {
  const [size, setSize] = useState({ width: 300, height: 160 });
  function add(event: GestureResponderEvent, start: boolean) {
    if (readonly || value.length >= 3000) return;
    const { locationX, locationY } = event.nativeEvent;
    const next = {
      x: Math.max(0, Math.min(1, locationX / size.width)),
      y: Math.max(0, Math.min(1, locationY / size.height)),
      start,
    };
    onChange([...value, next]);
  }
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.h3}>Handwritten signature</Text>
      <View
        accessibilityLabel={
          readonly
            ? 'Your saved handwritten signature'
            : 'Signature drawing area. Draw with a finger, stylus, or mouse.'
        }
        onLayout={(e) => setSize(e.nativeEvent.layout)}
        onStartShouldSetResponder={() => !readonly}
        onMoveShouldSetResponder={() => !readonly}
        onResponderGrant={(e) => add(e, true)}
        onResponderMove={(e) => add(e, false)}
        style={{
          width: '100%',
          height: 160,
          borderWidth: 1,
          borderColor: colors.muted,
          borderRadius: 12,
          backgroundColor: 'white',
          overflow: 'hidden',
        }}
      >
        {value.map((point, i) => {
          if (!i || point.start) return null;
          const previous = value[i - 1];
          const dx = (point.x - previous.x) * size.width;
          const dy = (point.y - previous.y) * size.height;
          const length = Math.sqrt(dx * dx + dy * dy);
          return (
            <View
              key={i}
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                left: ((point.x + previous.x) * size.width) / 2 - length / 2,
                top: ((point.y + previous.y) * size.height) / 2,
                width: Math.max(length, 2),
                height: 2,
                backgroundColor: colors.ink,
                borderRadius: 1,
                transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
              }}
            />
          );
        })}
      </View>
      {!readonly && <Button title="Clear signature" variant="ghost" onPress={() => onChange([])} />}
    </View>
  );
}
