import {
  Canvas,
  Group,
  Image,
  Rect,
  RoundedRect,
  rect,
  rrect,
  useImage,
  vec,
  type Transforms3d,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

export const POSTCARD_ASPECT_RATIO = 148 / 105;

type SkiaPostcardProps = {
  readonly frontImage: string | null;
  readonly height: number;
  readonly rotationX: SharedValue<number>;
  readonly rotationY: SharedValue<number>;
  readonly scale: SharedValue<number>;
  readonly translateX: SharedValue<number>;
  readonly translateY: SharedValue<number>;
  readonly width: number;
};

export function SkiaPostcard({
  frontImage,
  height,
  rotationX,
  rotationY,
  scale,
  translateX,
  translateY,
  width,
}: SkiaPostcardProps) {
  const image = useImage(frontImage);
  const padding = Math.max(10, Math.min(width, height) * 0.035);
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const cardWidth = Math.min(
    availableWidth,
    availableHeight * POSTCARD_ASPECT_RATIO,
  );
  const cardHeight = cardWidth / POSTCARD_ASPECT_RATIO;
  const cardX = (width - cardWidth) / 2;
  const cardY = (height - cardHeight) / 2;
  const center = vec(width / 2, height / 2);
  const cornerRadius = Math.max(10, cardWidth * 0.035);
  const cardRect = rect(cardX, cardY, cardWidth, cardHeight);
  const cardClip = rrect(cardRect, cornerRadius, cornerRadius);
  const perspective = Math.max(width, height) * 2.8;

  const transform = useDerivedValue<Transforms3d>(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { perspective },
    { scale: scale.value },
    { rotateX: rotationX.value },
    { rotateY: rotationY.value },
  ]);
  const frontZIndex = useDerivedValue(() =>
    Math.cos(rotationY.value) >= 0 ? 1 : 0,
  );
  const backZIndex = useDerivedValue(() =>
    Math.cos(rotationY.value) < 0 ? 1 : 0,
  );
  const backMirror: Transforms3d = [{ scaleX: -1 }];

  return (
    <Canvas style={{ height, width }}>
      <Group origin={center} transform={transform}>
        <Group clip={cardClip} zIndex={frontZIndex}>
          {image ? (
            <Image
              fit="cover"
              height={cardHeight}
              image={image}
              width={cardWidth}
              x={cardX}
              y={cardY}
            />
          ) : (
            <Rect color="#e9e5da" rect={cardRect} />
          )}
        </Group>

        <Group
          clip={cardClip}
          origin={center}
          transform={backMirror}
          zIndex={backZIndex}>
          <RoundedRect color="#f2eee5" rect={cardClip} />
        </Group>
      </Group>
    </Canvas>
  );
}
