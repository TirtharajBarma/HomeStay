import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface RadarViewProps {
  size?: number;
}

export const RadarView: React.FC<RadarViewProps> = ({ size = 180 }) => {
  const [pulse1] = React.useState(() => new Animated.Value(0));
  const [pulse2] = React.useState(() => new Animated.Value(0));
  const [pulse3] = React.useState(() => new Animated.Value(0));

  useEffect(() => {
    const createAnim = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    const a1 = createAnim(pulse1, 0);
    const a2 = createAnim(pulse2, 700);
    const a3 = createAnim(pulse3, 1400);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [pulse1, pulse2, pulse3]);

  const renderRing = (anim: Animated.Value, key: number) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.2, 1],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0.8, 0.3, 0],
    });

    return (
      <Animated.View
        key={key}
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {renderRing(pulse1, 1)}
      {renderRing(pulse2, 2)}
      {renderRing(pulse3, 3)}
      <View style={styles.centerDot}>
        <Ionicons name="car" size={24} color={Colors.white} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandPrimaryLight,
  },
  centerDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.brandPrimaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
