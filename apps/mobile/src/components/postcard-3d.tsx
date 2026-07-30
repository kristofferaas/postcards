/* eslint-disable react-hooks/refs, react/no-unknown-property --
 * Gesture callbacks read refs when an interaction fires, not during render.
 * Three Fiber's scene elements intentionally use non-DOM JSX properties. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Group } from 'three';

import type { Postcard } from '@/api/postcards';
import { Canvas } from '@/components/three-canvas';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Transform = {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
};

const INITIAL_TRANSFORM: Transform = {
  rotationX: -0.08,
  rotationY: -0.28,
  rotationZ: -0.03,
  scale: 1,
};

const postcardPalettes = [
  { paper: '#f4bd86', edge: '#b85f4b', ink: '#583634', stamp: '#177c7a' },
  { paper: '#a8d9ce', edge: '#39776f', ink: '#244a4a', stamp: '#e16c5b' },
  { paper: '#e6c7dc', edge: '#906583', ink: '#513b55', stamp: '#c75252' },
  { paper: '#f2dda4', edge: '#bd883d', ink: '#5d482d', stamp: '#466d9c' },
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function PostcardModel({
  postcard,
  transform,
}: {
  readonly postcard: Postcard;
  readonly transform: React.RefObject<Transform>;
}) {
  const group = useRef<Group>(null);
  const palette = postcardPalettes[(postcard.id - 1) % postcardPalettes.length];

  useFrame(({ clock }, delta) => {
    if (!group.current) {
      return;
    }

    const easing = 1 - Math.exp(-delta * 12);
    const target = transform.current;

    group.current.rotation.x += (target.rotationX - group.current.rotation.x) * easing;
    group.current.rotation.y += (target.rotationY - group.current.rotation.y) * easing;
    group.current.rotation.z += (target.rotationZ - group.current.rotation.z) * easing;

    const nextScale = group.current.scale.x + (target.scale - group.current.scale.x) * easing;
    group.current.scale.setScalar(nextScale);
    group.current.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.035;
  });

  return (
    <group
      ref={group}
      rotation={[INITIAL_TRANSFORM.rotationX, INITIAL_TRANSFORM.rotationY, INITIAL_TRANSFORM.rotationZ]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.25, 2.05, 0.1]} />
        <meshStandardMaterial color={palette.paper} roughness={0.76} />
      </mesh>

      <mesh position={[0, 0, 0.056]}>
        <planeGeometry args={[3.08, 1.88]} />
        <meshStandardMaterial color={palette.paper} roughness={0.86} />
      </mesh>

      <mesh position={[1.15, 0.61, 0.068]}>
        <boxGeometry args={[0.48, 0.48, 0.018]} />
        <meshStandardMaterial color={palette.stamp} roughness={0.65} />
      </mesh>
      <mesh position={[-0.04, 0, 0.069]}>
        <boxGeometry args={[0.018, 1.35, 0.012]} />
        <meshStandardMaterial color={palette.ink} opacity={0.55} transparent />
      </mesh>

      {[-0.2, -0.5, -0.8].map((y, index) => (
        <mesh key={y} position={[0.77 - index * 0.06, y, 0.069]}>
          <boxGeometry args={[1.02 - index * 0.12, 0.025, 0.012]} />
          <meshStandardMaterial color={palette.ink} opacity={0.62} transparent />
        </mesh>
      ))}

      <mesh position={[-0.83, 0.27, 0.069]}>
        <torusGeometry args={[0.29, 0.022, 12, 40]} />
        <meshStandardMaterial color={palette.stamp} roughness={0.65} />
      </mesh>
      <mesh position={[-0.83, 0.27, 0.07]}>
        <circleGeometry args={[0.09, 32]} />
        <meshStandardMaterial color={palette.stamp} />
      </mesh>

      <mesh position={[0, 0, -0.056]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3.08, 1.88]} />
        <meshStandardMaterial color={palette.edge} roughness={0.8} />
      </mesh>
      {[-0.46, -0.18, 0.1, 0.38].map((y, index) => (
        <mesh key={y} position={[-0.12, y, -0.069]} rotation={[Math.PI, 0, 0]}>
          <boxGeometry args={[2.05 - index * 0.16, 0.035, 0.012]} />
          <meshStandardMaterial color={palette.paper} opacity={0.72} transparent />
        </mesh>
      ))}
    </group>
  );
}

export function Postcard3D({ postcard }: { readonly postcard: Postcard }) {
  const transform = useRef<Transform>({ ...INITIAL_TRANSFORM });
  const panOrigin = useRef({ x: 0, y: 0 });
  const pinchOrigin = useRef(INITIAL_TRANSFORM.scale);
  const rotationOrigin = useRef(INITIAL_TRANSFORM.rotationZ);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minPointers(1)
      .maxPointers(1)
      .runOnJS(true)
      .onBegin(() => {
        panOrigin.current = {
          x: transform.current.rotationX,
          y: transform.current.rotationY,
        };
      })
      .onUpdate((event) => {
        transform.current.rotationX = clamp(
          panOrigin.current.x + event.translationY * 0.009,
          -1.35,
          1.35,
        );
        transform.current.rotationY = panOrigin.current.y + event.translationX * 0.009;
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        pinchOrigin.current = transform.current.scale;
      })
      .onUpdate((event) => {
        transform.current.scale = clamp(pinchOrigin.current * event.scale, 0.7, 1.65);
      });

    const rotation = Gesture.Rotation()
      .runOnJS(true)
      .onBegin(() => {
        rotationOrigin.current = transform.current.rotationZ;
      })
      .onUpdate((event) => {
        transform.current.rotationZ = rotationOrigin.current + event.rotation;
      });

    const reset = Gesture.Tap()
      .numberOfTaps(2)
      .maxDistance(14)
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) {
          transform.current = { ...INITIAL_TRANSFORM };
        }
      });

    return Gesture.Simultaneous(pan, pinch, rotation, reset);
  }, []);

  return (
    <View style={styles.shell}>
      <Canvas
        camera={{ fov: 42, position: [0, 0, 5.25] }}
        gl={{ alpha: true, antialias: false }}>
        <ambientLight intensity={1.8} />
        <directionalLight intensity={2.6} position={[3, 4, 5]} />
        <pointLight intensity={1.4} position={[-3, -2, 3]} />
        <PostcardModel postcard={postcard} transform={transform} />
      </Canvas>

      <GestureDetector gesture={gesture}>
        <View collapsable={false} style={styles.gestureSurface} />
      </GestureDetector>

      <View style={styles.hint}>
        <ThemedText style={styles.hintText} type="smallBold">
          Drag to rotate · Pinch to zoom · Twist to roll
        </ThemedText>
        <ThemedText style={styles.hintText} type="small">
          Double-tap to reset
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#dce8e5',
    borderRadius: Spacing.four,
    height: 360,
    position: 'relative',
  },
  gestureSurface: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hint: {
    alignItems: 'center',
    bottom: Spacing.three,
    left: Spacing.three,
    pointerEvents: 'none',
    position: 'absolute',
    right: Spacing.three,
  },
  hintText: {
    color: '#254440',
    textAlign: 'center',
  },
});
