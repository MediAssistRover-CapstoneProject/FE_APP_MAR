import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface Props {
  color?: string;
  count?: number;
  height?: number;
}

export function AudioWaveform({ color = '#FFFFFF', count = 14, height = 28 }: Props) {
  const animatedValues = useRef(
    Array.from({ length: count }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations = animatedValues.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.2 + ((index % 5) + 1) * 0.16,
            duration: 250 + (index % 4) * 120,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.15,
            duration: 250 + (index % 4) * 120,
            useNativeDriver: true,
          }),
        ])
      );
    });

    Animated.parallel(animations).start();

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [animatedValues]);

  return (
    <View style={[styles.container, { height }]}>
      {animatedValues.map((anim, idx) => (
        <Animated.View
          key={idx}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    justifyContent: 'center',
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});
