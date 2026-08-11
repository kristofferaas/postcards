import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SkiaPostcard } from '@/components/skia-postcard';

const MAX_VERTICAL_TILT_RADIANS = 0.72;
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 2.4;
const FACE_SWIPE_DISTANCE = 44;
const FACE_SWIPE_VELOCITY = 520;
const HORIZONTAL_SWIPE_DOMINANCE = 1.15;
const ROTATION_SPRING = {
  damping: 22,
  mass: 0.8,
  stiffness: 230,
};
const RESET_SPRING = {
  damping: 24,
  mass: 0.7,
  stiffness: 260,
};

const clamp = (value: number, minimum: number, maximum: number) => {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
};

type InteractiveSkiaPostcardProps = {
  readonly frontImage: string | null;
  readonly height: number;
  readonly width: number;
};

export function InteractiveSkiaPostcard({
  frontImage,
  height,
  width,
}: InteractiveSkiaPostcardProps) {
  const rotationX = useSharedValue(0);
  const rotationY = useSharedValue(0);
  const rotationXOrigin = useSharedValue(0);
  const rotationYOrigin = useSharedValue(0);
  const scale = useSharedValue(1);
  const scaleOrigin = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const translateXOrigin = useSharedValue(0);
  const translateYOrigin = useSharedValue(0);
  const focalXOrigin = useSharedValue(0);
  const focalYOrigin = useSharedValue(0);
  const pinching = useSharedValue(false);

  const reset = () => {
    'worklet';
    rotationX.value = withSpring(0, RESET_SPRING);
    rotationY.value = withSpring(0, RESET_SPRING);
    scale.value = withSpring(1, RESET_SPRING);
    translateX.value = withSpring(0, RESET_SPRING);
    translateY.value = withSpring(0, RESET_SPRING);
  };

  const pan = Gesture.Pan()
    .minDistance(2)
    .maxPointers(1)
    .onBegin(() => {
      cancelAnimation(rotationX);
      cancelAnimation(rotationY);
      rotationXOrigin.value = rotationX.value;
      rotationYOrigin.value = rotationY.value;
    })
    .onUpdate((event) => {
      if (pinching.value || event.numberOfPointers !== 1) return;

      rotationX.value = clamp(
        rotationXOrigin.value + event.translationY * 0.007,
        -MAX_VERTICAL_TILT_RADIANS,
        MAX_VERTICAL_TILT_RADIANS,
      );
      rotationY.value = rotationYOrigin.value + event.translationX * 0.008;
    })
    .onEnd((event) => {
      if (pinching.value) return;

      const horizontalMovement = Math.abs(event.translationX);
      const isHorizontalSwipe =
        horizontalMovement >
          Math.abs(event.translationY) * HORIZONTAL_SWIPE_DOMINANCE &&
        (horizontalMovement >= FACE_SWIPE_DISTANCE ||
          Math.abs(event.velocityX) >= FACE_SWIPE_VELOCITY);
      const currentFace = Math.round(rotationYOrigin.value / Math.PI) * Math.PI;
      const targetRotationY = isHorizontalSwipe
        ? currentFace + (event.translationX < 0 ? -Math.PI : Math.PI)
        : Math.round(rotationY.value / Math.PI) * Math.PI;

      rotationX.value = withSpring(0, ROTATION_SPRING);
      rotationY.value = withSpring(targetRotationY, ROTATION_SPRING);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      pinching.value = true;
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    })
    .onStart((event) => {
      scaleOrigin.value = scale.value;
      translateXOrigin.value = translateX.value;
      translateYOrigin.value = translateY.value;
      focalXOrigin.value = event.focalX - width / 2;
      focalYOrigin.value = event.focalY - height / 2;
    })
    .onUpdate((event) => {
      const nextScale = clamp(
        scaleOrigin.value * event.scale,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const scaleRatio = nextScale / scaleOrigin.value;

      scale.value = nextScale;
      translateX.value =
        scaleRatio * translateXOrigin.value +
        (1 - scaleRatio) * focalXOrigin.value;
      translateY.value =
        scaleRatio * translateYOrigin.value +
        (1 - scaleRatio) * focalYOrigin.value;
    })
    .onFinalize(() => {
      pinching.value = false;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(18)
    .onEnd((_event, success) => {
      if (success) reset();
    });

  const gesture = Gesture.Exclusive(
    doubleTap,
    Gesture.Simultaneous(pan, pinch),
  );

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={styles.surface}>
        <SkiaPostcard
          frontImage={frontImage}
          height={height}
          rotationX={rotationX}
          rotationY={rotationY}
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          width={width}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
  },
});
