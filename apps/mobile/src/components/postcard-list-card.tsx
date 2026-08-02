import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import type { Postcard } from '@/api/postcards';
import { SkiaPostcard } from '@/components/skia-postcard';

type PostcardListCardProps = {
  readonly cardHeight: number;
  readonly cardWidth: number;
  readonly index: number;
  readonly isLast: boolean;
  readonly itemOffset: number;
  readonly postcard: Postcard;
  readonly reducedMotion: boolean;
  readonly scrollY: SharedValue<number>;
  readonly stride: number;
  readonly viewportHeight: number;
};

const FLIP_SPRING = {
  damping: 22,
  mass: 0.82,
  stiffness: 220,
};

const clamp = (value: number, minimum: number, maximum: number) => {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
};

export function PostcardListCard({
  cardHeight,
  cardWidth,
  index,
  isLast,
  itemOffset,
  postcard,
  reducedMotion,
  scrollY,
  stride,
  viewportHeight,
}: PostcardListCardProps) {
  const [showingBack, setShowingBack] = useState(false);
  const flipRotation = useSharedValue(0);

  const position = useDerivedValue(() => {
    const screenCenter = itemOffset - scrollY.value + cardHeight / 2;
    const focus = viewportHeight * 0.45;
    return clamp((screenCenter - focus) / cardHeight, -1.5, 1.5);
  });
  const rotationX = useDerivedValue(() =>
    reducedMotion ? 0 : clamp(position.value * -0.15, -0.23, 0.23),
  );
  const rotationY = useDerivedValue(() => {
    const deckLean = index % 2 === 0 ? -0.035 : 0.035;
    const scrollLean = clamp(position.value * 0.025, -0.04, 0.04);
    return flipRotation.value + (reducedMotion ? 0 : deckLean + scrollLean);
  });
  const scale = useDerivedValue(() =>
    reducedMotion
      ? 1
      : 1 - Math.min(0.1, Math.abs(position.value) * 0.055),
  );
  const translateX = useDerivedValue(() =>
    reducedMotion
      ? 0
      : (index % 2 === 0 ? -4 : 4) + clamp(position.value * 3, -5, 5),
  );
  const translateY = useDerivedValue(() => 0);

  const flip = () => {
    const nextShowingBack = !showingBack;
    setShowingBack(nextShowingBack);
    const nextRotation = nextShowingBack ? Math.PI : 0;
    flipRotation.value = reducedMotion
      ? nextRotation
      : withSpring(nextRotation, FLIP_SPRING);
  };

  return (
    <View
      style={[
        styles.row,
        {
          height: isLast ? cardHeight : stride,
          zIndex: index + 1,
        },
      ]}>
      <Pressable
        accessibilityHint="Turns the postcard over"
        accessibilityLabel="Postcard"
        accessibilityRole="button"
        onPress={flip}
        style={({ pressed }) => [
          styles.cardButton,
          { height: cardHeight, width: cardWidth },
          pressed && styles.pressed,
        ]}>
        <SkiaPostcard
          frontImage={postcard.frontImage}
          height={cardHeight}
          rotationX={rotationX}
          rotationY={rotationY}
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          width={cardWidth}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    overflow: 'visible',
    width: '100%',
  },
  cardButton: {
    borderCurve: 'continuous',
    position: 'absolute',
    top: 0,
  },
  pressed: {
    opacity: 0.76,
  },
});
