import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { radii, spacing } from '../../theme/tokens';

function withAlpha(hexColor, alphaHex) {
  if (typeof hexColor !== 'string') return hexColor;
  if (hexColor.startsWith('#') && hexColor.length === 7) return `${hexColor}${alphaHex}`;
  return hexColor;
}

export function ShimmerBlock({ theme, style, borderRadius = radii.sm }) {
  const translateX = useRef(new Animated.Value(-120)).current;

  const baseBg = useMemo(() => withAlpha(theme?.secondary || '#e5e7eb', 'B3'), [theme]);
  const glowBg = useMemo(() => withAlpha(theme?.card || '#ffffff', 'CC'), [theme]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 320,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [translateX]);

  return (
    <View
      style={[
        {
          overflow: 'hidden',
          backgroundColor: baseBg,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 100,
          transform: [{ translateX }],
          backgroundColor: glowBg,
          opacity: 0.45,
        }}
      />
    </View>
  );
}

export function ShimmerText({ theme, lines = 2 }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {Array.from({ length: lines }).map((_, idx) => (
        <ShimmerBlock
          key={`line-${idx}`}
          theme={theme}
          borderRadius={radii.xs}
          style={{
            height: 12,
            width: idx === lines - 1 ? '70%' : '100%',
          }}
        />
      ))}
    </View>
  );
}

export function ShimmerAvatar({ theme, size = 44 }) {
  return (
    <ShimmerBlock
      theme={theme}
      borderRadius={size / 2}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}

