import { useRouter } from 'expo-router';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPostcard, type CreatePostcardInput } from '@/api/postcards';
import { postcardImageSource } from '@/components/postcard-preview';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';

type EditorSide = 'front' | 'back';
type EditorTool = 'select' | 'pen';
type Point = { readonly x: number; readonly y: number };
type Stroke = {
  readonly id: string;
  readonly color: string;
  readonly size: number;
  readonly points: readonly Point[];
};
type CanvasElement = {
  readonly id: string;
  readonly kind: 'text' | 'sticker' | 'photo';
  readonly value: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
  readonly rotation: number;
};
type SideContent = {
  readonly elements: readonly CanvasElement[];
  readonly strokes: readonly Stroke[];
};
type CanvasState = Record<EditorSide, SideContent>;
type EditorHistory = {
  readonly past: readonly CanvasState[];
  readonly present: CanvasState;
  readonly future: readonly CanvasState[];
};
type HistoryAction =
  | {
      readonly type: 'change';
      readonly side: EditorSide;
      readonly change: (content: SideContent) => SideContent;
    }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' };

const accentColors = ['#fc5d3d', '#215cdb', '#169b72', '#f1b82d', '#19191c'];
const stickerOptions = ['✨', '☀️', '💙', '🌿', '🍒', '🧡', '🏔️', '🫶'];

const initialCanvas: CanvasState = {
  front: {
    elements: [
      {
        color: '#ffffff',
        id: 'front-title',
        kind: 'text',
        rotation: -2,
        size: 30,
        value: 'Wish you were here',
        x: 0.08,
        y: 0.73,
      },
      {
        color: '#ffffff',
        id: 'front-sparkle',
        kind: 'sticker',
        rotation: 8,
        size: 38,
        value: '✨',
        x: 0.82,
        y: 0.1,
      },
    ],
    strokes: [],
  },
  back: {
    elements: [
      {
        color: '#28423e',
        id: 'back-note',
        kind: 'text',
        rotation: -1,
        size: 23,
        value: 'Write something wonderful…',
        x: 0.07,
        y: 0.18,
      },
    ],
    strokes: [],
  },
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function historyReducer(state: EditorHistory, action: HistoryAction): EditorHistory {
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      future: [state.present, ...state.future].slice(0, 30),
      past: state.past.slice(0, -1),
      present: previous,
    };
  }

  if (action.type === 'redo') {
    const next = state.future[0];
    if (!next) return state;
    return {
      future: state.future.slice(1),
      past: [...state.past, state.present].slice(-30),
      present: next,
    };
  }

  const nextSide = action.change(state.present[action.side]);
  if (nextSide === state.present[action.side]) return state;
  return {
    future: [],
    past: [...state.past, state.present].slice(-30),
    present: { ...state.present, [action.side]: nextSide },
  };
}

type ToolButtonProps = {
  readonly active?: boolean;
  readonly icon: string;
  readonly label: string;
  readonly onPress: () => void;
};

function ToolButton({ active = false, icon, label, onPress }: ToolButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolButton,
        active && styles.toolButtonActive,
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.toolIcon, active && styles.toolTextActive]}>{icon}</ThemedText>
      <ThemedText style={[styles.toolLabel, active && styles.toolTextActive]}>{label}</ThemedText>
    </Pressable>
  );
}

type DraggableElementProps = {
  readonly canvasHeight: number;
  readonly canvasWidth: number;
  readonly element: CanvasElement;
  readonly selected: boolean;
  readonly tool: EditorTool;
  readonly onChange: (patch: Partial<CanvasElement>) => void;
  readonly onSelect: () => void;
};

function DraggableElement({
  canvasHeight,
  canvasWidth,
  element,
  onChange,
  onSelect,
  selected,
  tool,
}: DraggableElementProps) {
  const [preview, setPreview] = useState<Point | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => tool === 'select' && element.kind !== 'text',
        onMoveShouldSetPanResponder: (_, gesture) =>
          tool === 'select' && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
        onPanResponderGrant: () => {
          onSelect();
        },
        onPanResponderMove: (_, gesture) => {
          setPreview({
            x: clamp(element.x + gesture.dx / canvasWidth, 0, 0.88),
            y: clamp(element.y + gesture.dy / canvasHeight, 0, 0.86),
          });
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3) {
            onChange({
              x: clamp(element.x + gesture.dx / canvasWidth, 0, 0.88),
              y: clamp(element.y + gesture.dy / canvasHeight, 0, 0.86),
            });
          }
          setPreview(null);
        },
        onPanResponderTerminate: () => setPreview(null),
      }),
    [canvasHeight, canvasWidth, element.kind, element.x, element.y, onChange, onSelect, tool],
  );

  const position = preview ?? element;
  const displayScale = clamp(canvasWidth / 760, 0.55, 1);
  const displaySize = element.size * displayScale;
  const elementStyle = {
    left: position.x * canvasWidth,
    top: position.y * canvasHeight,
    transform: [{ rotate: `${element.rotation}deg` }],
  };

  return (
    <View
      accessibilityLabel={`${element.kind} canvas object`}
      onTouchStart={onSelect}
      style={[styles.canvasElement, elementStyle]}
      {...panResponder.panHandlers}>
      {element.kind === 'text' ? (
        <TextInput
          accessibilityLabel="Canvas text"
          maxLength={120}
          multiline
          onChangeText={(value) => onChange({ value })}
          onFocus={onSelect}
          placeholder="Type something"
          placeholderTextColor={`${element.color}99`}
          selectionColor={element.color}
          style={[
            styles.canvasTextInput,
            {
              color: element.color,
              fontSize: displaySize,
              lineHeight: displaySize * 1.12,
              minHeight: displaySize * 2.4,
              width: clamp(canvasWidth * 0.62, 160, 340),
            },
            selected && styles.selectedElement,
          ]}
          value={element.value}
        />
      ) : element.kind === 'sticker' ? (
        <View style={[styles.stickerElement, selected && styles.selectedElement]}>
          <ThemedText style={{ fontSize: displaySize, lineHeight: displaySize * 1.18 }}>
            {element.value}
          </ThemedText>
        </View>
      ) : (
        <View
          style={[
            styles.photoElement,
            {
              height: displaySize * 2.3,
              width: displaySize * 3.1,
            },
            selected && styles.selectedElement,
          ]}>
          <Image contentFit="cover" source={{ uri: element.value }} style={StyleSheet.absoluteFill} />
        </View>
      )}
      {selected ? <View pointerEvents="none" style={styles.dragHandle}><ThemedText style={styles.dragHandleText}>✣</ThemedText></View> : null}
    </View>
  );
}

function StrokeView({
  canvasHeight,
  canvasWidth,
  stroke,
}: {
  readonly canvasHeight: number;
  readonly canvasWidth: number;
  readonly stroke: Stroke;
}) {
  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    return (
      <View
        pointerEvents="none"
        style={[
          styles.strokeDot,
          {
            backgroundColor: stroke.color,
            height: stroke.size,
            left: point.x * canvasWidth - stroke.size / 2,
            top: point.y * canvasHeight - stroke.size / 2,
            width: stroke.size,
          },
        ]}
      />
    );
  }

  return (
    <>
      {stroke.points.slice(1).map((point, index) => {
        const previous = stroke.points[index];
        const x1 = previous.x * canvasWidth;
        const y1 = previous.y * canvasHeight;
        const x2 = point.x * canvasWidth;
        const y2 = point.y * canvasHeight;
        const distance = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1);

        return (
          <View
            key={`${stroke.id}-${index}`}
            pointerEvents="none"
            style={[
              styles.strokeSegment,
              {
                backgroundColor: stroke.color,
                height: stroke.size,
                left: (x1 + x2) / 2 - distance / 2,
                top: (y1 + y2) / 2 - stroke.size / 2,
                transform: [{ rotate: `${angle}rad` }],
                width: distance + stroke.size / 2,
              },
            ]}
          />
        );
      })}
    </>
  );
}

function PostcardBacking() {
  return (
    <View pointerEvents="none" style={styles.backing}>
      <View style={styles.backPostmark}>
        <ThemedText style={styles.postmarkAir}>AIR MAIL</ThemedText>
        <ThemedText style={styles.postmarkPlace}>OSLO · NORWAY</ThemedText>
      </View>
      <View style={styles.backDivider} />
      <View style={styles.backStamp}>
        <ThemedText style={styles.stampBird}>⌁</ThemedText>
        <ThemedText style={styles.stampValue}>NORDEN · 20</ThemedText>
      </View>
      <View style={styles.addressBlock}>
        <ThemedText style={styles.addressLabel}>DELIVER TO</ThemedText>
        {[0, 1, 2, 3].map((line) => (
          <View key={line} style={styles.addressLine} />
        ))}
      </View>
      <ThemedText style={styles.cardSerial}>POST CARD · NO. 0048</ThemedText>
    </View>
  );
}

type CanvasProps = {
  readonly backgroundImage: string;
  readonly content: SideContent;
  readonly currentStroke: Stroke | null;
  readonly penColor: string;
  readonly penSize: number;
  readonly selectedId: string | null;
  readonly side: EditorSide;
  readonly tool: EditorTool;
  readonly onAddStroke: (stroke: Stroke) => void;
  readonly onChangeElement: (id: string, patch: Partial<CanvasElement>) => void;
  readonly onSelect: (id: string | null) => void;
  readonly onStrokeChange: (stroke: Stroke | null) => void;
};

function PostcardCanvas({
  backgroundImage,
  content,
  currentStroke,
  onAddStroke,
  onChangeElement,
  onSelect,
  onStrokeChange,
  penColor,
  penSize,
  selectedId,
  side,
  tool,
}: CanvasProps) {
  const [size, setSize] = useState({ height: 1, width: 1 });
  const strokeRef = useRef<Stroke | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setSize({ height, width });
  };

  const beginStroke = (x: number, y: number) => {
    if (tool !== 'pen') return;
    const stroke: Stroke = {
      color: penColor,
      id: createId(),
      points: [{ x: clamp(x / size.width, 0, 1), y: clamp(y / size.height, 0, 1) }],
      size: penSize,
    };
    strokeRef.current = stroke;
    onStrokeChange(stroke);
  };

  const continueStroke = (x: number, y: number) => {
    const current = strokeRef.current;
    if (!current) return;
    const nextPoint = {
      x: clamp(x / size.width, 0, 1),
      y: clamp(y / size.height, 0, 1),
    };
    const previous = current.points.at(-1);
    if (
      previous &&
      Math.hypot(
        (nextPoint.x - previous.x) * size.width,
        (nextPoint.y - previous.y) * size.height,
      ) < 2
    ) {
      return;
    }
    const next = { ...current, points: [...current.points, nextPoint] };
    strokeRef.current = next;
    onStrokeChange(next);
  };

  const finishStroke = () => {
    if (strokeRef.current) onAddStroke(strokeRef.current);
    strokeRef.current = null;
    onStrokeChange(null);
  };

  return (
    <View
      accessibilityLabel={`${side} of postcard canvas`}
      onLayout={onLayout}
      onResponderGrant={(event) => {
        onSelect(null);
        beginStroke(event.nativeEvent.locationX, event.nativeEvent.locationY);
      }}
      onResponderMove={(event) =>
        continueStroke(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      onResponderRelease={finishStroke}
      onResponderTerminate={finishStroke}
      onStartShouldSetResponder={() => tool === 'pen'}
      style={[styles.cardCanvas, side === 'back' && styles.cardCanvasBack]}>
      {side === 'front' ? (
        <>
          <Image
            contentFit="cover"
            source={postcardImageSource(backgroundImage)}
            style={StyleSheet.absoluteFill}
            transition={180}
          />
          <View pointerEvents="none" style={styles.photoWash} />
        </>
      ) : (
        <PostcardBacking />
      )}

      {content.strokes.map((stroke) => (
        <StrokeView
          canvasHeight={size.height}
          canvasWidth={size.width}
          key={stroke.id}
          stroke={stroke}
        />
      ))}
      {currentStroke ? (
        <StrokeView
          canvasHeight={size.height}
          canvasWidth={size.width}
          stroke={currentStroke}
        />
      ) : null}

      {content.elements.map((element) => (
        <DraggableElement
          canvasHeight={size.height}
          canvasWidth={size.width}
          element={element}
          key={element.id}
          onChange={(patch) => onChangeElement(element.id, patch)}
          onSelect={() => onSelect(element.id)}
          selected={selectedId === element.id}
          tool={tool}
        />
      ))}

      {tool === 'pen' ? (
        <View pointerEvents="none" style={styles.drawingBadge}>
          <View style={[styles.penDot, { backgroundColor: penColor }]} />
          <ThemedText style={styles.drawingBadgeText}>DRAWING</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export default function CreatePostcardScreen() {
  const router = useRouter();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 760;
  const [history, dispatch] = useState<EditorHistory>({
    future: [],
    past: [],
    present: initialCanvas,
  });
  const reduceHistory = (action: HistoryAction) => {
    dispatch((current) => historyReducer(current, action));
  };
  const [side, setSide] = useState<EditorSide>('front');
  const [tool, setTool] = useState<EditorTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>('front-title');
  const [penColor, setPenColor] = useState(accentColors[0]);
  const [penSize, setPenSize] = useState(5);
  const [frontImage, setFrontImage] = useState('fjord');
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = history.present[side];
  const selectedElement = content.elements.find(({ id }) => id === selectedId) ?? null;
  const canvasWidth = Math.max(
    280,
    Math.min(compact ? windowWidth - 24 : windowWidth - 240, 920, (windowHeight - 210) * 1.5),
  );

  const changeSide = (next: EditorSide) => {
    setSide(next);
    setSelectedId(null);
    setShowStickers(false);
    setTool('select');
  };

  const changeCurrentSide = (change: (current: SideContent) => SideContent) =>
    reduceHistory({ change, side, type: 'change' });

  const addElement = (kind: CanvasElement['kind'], value: string) => {
    const element: CanvasElement = {
      color: kind === 'text' ? (side === 'front' ? '#ffffff' : '#28423e') : '#ffffff',
      id: createId(),
      kind,
      rotation: kind === 'sticker' ? -6 : 0,
      size: kind === 'text' ? 28 : kind === 'photo' ? 58 : 38,
      value,
      x: 0.18 + Math.random() * 0.16,
      y: 0.24 + Math.random() * 0.16,
    };
    changeCurrentSide((current) => ({
      ...current,
      elements: [...current.elements, element],
    }));
    setSelectedId(element.id);
    setTool('select');
    setShowStickers(false);
  };

  const updateSelected = (patch: Partial<CanvasElement>) => {
    if (!selectedId) return;
    changeCurrentSide((current) => ({
      ...current,
      elements: current.elements.map((element) =>
        element.id === selectedId ? ({ ...element, ...patch } as CanvasElement) : element,
      ),
    }));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    changeCurrentSide((current) => ({
      ...current,
      elements: current.elements.filter(({ id }) => id !== selectedId),
    }));
    setSelectedId(null);
  };

  const choosePhoto = async (mode: 'background' | 'element') => {
    setError(null);
    if (requireOptionalNativeModule('ExponentImagePicker') === null) {
      setError('Photo tools require a new development build.');
      return;
    }

    try {
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: mode === 'background',
        aspect: mode === 'background' ? [3, 2] : undefined,
        base64: true,
        mediaTypes: ['images'],
        quality: 0.62,
      });
      if (result.canceled) return;
      const photo = result.assets[0];
      const image = photo.base64
        ? `data:${photo.mimeType ?? 'image/jpeg'};base64,${photo.base64}`
        : photo.uri;
      if (mode === 'background') setFrontImage(image);
      else addElement('photo', image);
    } catch {
      setError('Could not open your photo library. Check permissions and try again.');
    }
  };

  const sendPostcard = async () => {
    if (!to.trim() || !from.trim()) {
      setError('Add a recipient and your name before sending.');
      return;
    }

    const frontText = history.present.front.elements.find(({ kind }) => kind === 'text');
    const backText = history.present.back.elements
      .filter(({ kind }) => kind === 'text')
      .map(({ value }) => value.trim())
      .filter(Boolean)
      .join('\n\n');
    const stickers = [...history.present.front.elements, ...history.present.back.elements]
      .filter(({ kind }) => kind === 'sticker')
      .map(({ value }) => value)
      .slice(0, 4);
    const design: CreatePostcardInput = {
      accentColor: penColor,
      caption: frontText?.value ?? '',
      captionStyle: 'script',
      content: backText || 'Made with Post Cards.',
      from,
      frontImage,
      stamp: '✈️',
      stickers,
      to,
    };

    setSending(true);
    setError(null);
    try {
      await createPostcard(design);
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send your postcard.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.safeArea}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="Close editor"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <ThemedText style={styles.topIcon}>×</ThemedText>
            </Pressable>

            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <ThemedText style={styles.brandMarkText}>P</ThemedText>
              </View>
              {!compact ? <ThemedText style={styles.brandName}>POST CARDS</ThemedText> : null}
            </View>

            <View accessibilityRole="tablist" style={styles.sideTabs}>
              {(['front', 'back'] as const).map((value) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: side === value }}
                  key={value}
                  onPress={() => changeSide(value)}
                  style={[styles.sideTab, side === value && styles.sideTabActive]}>
                  <ThemedText
                    style={[styles.sideTabText, side === value && styles.sideTabTextActive]}>
                    {value === 'front' ? 'Front' : 'Back'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.topActions}>
              {!compact ? (
                <>
                  <Pressable
                    disabled={history.past.length === 0}
                    onPress={() => reduceHistory({ type: 'undo' })}
                    style={({ pressed }) => [
                      styles.iconButton,
                      history.past.length === 0 && styles.disabled,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText style={styles.actionGlyph}>↶</ThemedText>
                  </Pressable>
                  <Pressable
                    disabled={history.future.length === 0}
                    onPress={() => reduceHistory({ type: 'redo' })}
                    style={({ pressed }) => [
                      styles.iconButton,
                      history.future.length === 0 && styles.disabled,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText style={styles.actionGlyph}>↷</ThemedText>
                  </Pressable>
                </>
              ) : null}
              <Pressable
                onPress={() => {
                  setError(null);
                  setShowSend(true);
                }}
                style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
                <ThemedText style={styles.doneButtonText}>Done</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.workspace, compact && styles.workspaceCompact]}>
            <View style={[styles.toolRail, compact && styles.toolRailCompact]}>
              <ToolButton
                active={tool === 'select'}
                icon="↖"
                label="Select"
                onPress={() => {
                  setTool('select');
                  setShowStickers(false);
                }}
              />
              <ToolButton
                active={tool === 'pen'}
                icon="⌁"
                label="Draw"
                onPress={() => {
                  setTool('pen');
                  setSelectedId(null);
                  setShowStickers(false);
                }}
              />
              <ToolButton icon="T" label="Text" onPress={() => addElement('text', 'Type something')} />
              <ToolButton
                active={showStickers}
                icon="✦"
                label="Sticker"
                onPress={() => {
                  setShowStickers((visible) => !visible);
                  setTool('select');
                }}
              />
              <ToolButton
                icon="▧"
                label="Photo"
                onPress={() => void choosePhoto('element')}
              />
              {compact ? (
                <ToolButton
                  icon="↶"
                  label="Undo"
                  onPress={() => reduceHistory({ type: 'undo' })}
                />
              ) : null}
            </View>

            <View style={styles.stage}>
              <View style={styles.contextBar}>
                <View style={styles.contextCopy}>
                  <ThemedText style={styles.eyebrow}>
                    {side === 'front' ? 'PHOTO SIDE' : 'POSTCARD SIDE'}
                  </ThemedText>
                  <ThemedText numberOfLines={1} style={styles.contextTitle}>
                    {tool === 'pen'
                      ? 'Draw directly on the card'
                      : selectedElement
                        ? `${selectedElement.kind[0].toUpperCase()}${selectedElement.kind.slice(1)} selected`
                        : 'Tap an object to edit it'}
                  </ThemedText>
                </View>

                <ScrollView
                  contentContainerStyle={styles.contextActions}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.contextActionScroll}>
                  {tool === 'pen' ? (
                    <>
                      {accentColors.map((color) => (
                        <Pressable
                          accessibilityLabel={`Use ${color} pen`}
                          key={color}
                          onPress={() => setPenColor(color)}
                          style={[
                            styles.colorDot,
                            { backgroundColor: color },
                            penColor === color && styles.colorDotActive,
                          ]}
                        />
                      ))}
                      <Pressable
                        onPress={() => setPenSize((size) => (size >= 9 ? 3 : size + 2))}
                        style={styles.sizePill}>
                        <View
                          style={[
                            styles.sizePreview,
                            { backgroundColor: penColor, height: penSize, width: penSize },
                          ]}
                        />
                        <ThemedText style={styles.sizePillText}>{penSize}px</ThemedText>
                      </Pressable>
                    </>
                  ) : selectedElement ? (
                    <>
                      {selectedElement.kind === 'text'
                        ? accentColors.map((color) => (
                            <Pressable
                              accessibilityLabel={`Use ${color} text`}
                              key={color}
                              onPress={() => updateSelected({ color })}
                              style={[
                                styles.colorDot,
                                { backgroundColor: color },
                                selectedElement.color === color && styles.colorDotActive,
                              ]}
                            />
                          ))
                        : null}
                      <Pressable
                        onPress={() =>
                          updateSelected({ size: clamp(selectedElement.size - 3, 14, 100) })
                        }
                        style={styles.smallAction}>
                        <ThemedText style={styles.smallActionText}>−</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          updateSelected({ size: clamp(selectedElement.size + 3, 14, 100) })
                        }
                        style={styles.smallAction}>
                        <ThemedText style={styles.smallActionText}>+</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          updateSelected({ rotation: selectedElement.rotation + 8 })
                        }
                        style={styles.smallAction}>
                        <ThemedText style={styles.rotateAction}>↻</ThemedText>
                      </Pressable>
                      <Pressable onPress={deleteSelected} style={styles.deleteAction}>
                        <ThemedText style={styles.deleteActionText}>Delete</ThemedText>
                      </Pressable>
                    </>
                  ) : side === 'front' ? (
                    <Pressable
                      onPress={() => void choosePhoto('background')}
                      style={styles.replaceButton}>
                      <ThemedText style={styles.replaceButtonText}>▧ Change background</ThemedText>
                    </Pressable>
                  ) : (
                    <ThemedText style={styles.sameToolsNote}>All tools work on both sides</ThemedText>
                  )}
                </ScrollView>
              </View>

              <ScrollView
                contentContainerStyle={styles.canvasScroll}
                horizontal={compact}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}>
                <View
                  style={[
                    styles.canvasShadow,
                    { width: canvasWidth },
                    tool === 'pen' && styles.canvasDrawing,
                  ]}>
                  <PostcardCanvas
                    backgroundImage={frontImage}
                    content={content}
                    currentStroke={currentStroke}
                    onAddStroke={(stroke) =>
                      changeCurrentSide((current) => ({
                        ...current,
                        strokes: [...current.strokes, stroke],
                      }))
                    }
                    onChangeElement={(id, patch) =>
                      changeCurrentSide((current) => ({
                        ...current,
                        elements: current.elements.map((element) =>
                          element.id === id
                            ? ({ ...element, ...patch } as CanvasElement)
                            : element,
                        ),
                      }))
                    }
                    onSelect={setSelectedId}
                    onStrokeChange={setCurrentStroke}
                    penColor={penColor}
                    penSize={penSize}
                    selectedId={selectedId}
                    side={side}
                    tool={tool}
                  />
                </View>
              </ScrollView>

              <View style={styles.stageFooter}>
                <View style={styles.statusGroup}>
                  <View style={styles.savedDot} />
                  <ThemedText style={styles.footerText}>All changes saved</ThemedText>
                </View>
                <ThemedText style={styles.footerText}>100%</ThemedText>
                <ThemedText style={styles.footerText}>
                  {content.elements.length} objects · {content.strokes.length} strokes
                </ThemedText>
              </View>

              {showStickers ? (
                <View style={[styles.stickerPopover, compact && styles.stickerPopoverCompact]}>
                  <View style={styles.popoverHeading}>
                    <ThemedText style={styles.popoverTitle}>Add a sticker</ThemedText>
                    <Pressable onPress={() => setShowStickers(false)}>
                      <ThemedText style={styles.popoverClose}>×</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.stickerGrid}>
                    {stickerOptions.map((sticker) => (
                      <Pressable
                        accessibilityLabel={`Add ${sticker} sticker`}
                        key={sticker}
                        onPress={() => addElement('sticker', sticker)}
                        style={({ pressed }) => [
                          styles.stickerChoice,
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText style={styles.stickerChoiceText}>{sticker}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {error && !showSend ? (
            <View style={styles.toast}>
              <ThemedText style={styles.toastText}>{error}</ThemedText>
              <Pressable onPress={() => setError(null)}>
                <ThemedText style={styles.toastClose}>×</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {showSend ? (
            <View style={styles.modalScrim}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.modalKeyboard}>
                <Pressable
                  accessibilityLabel="Close send dialog"
                  onPress={() => setShowSend(false)}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.sendSheet}>
                  <View style={styles.sheetHandle} />
                  <View style={styles.sendHeading}>
                    <View>
                      <ThemedText style={styles.sendEyebrow}>READY TO TRAVEL</ThemedText>
                      <ThemedText style={styles.sendTitle}>Who’s it for?</ThemedText>
                    </View>
                    <Pressable onPress={() => setShowSend(false)} style={styles.sheetClose}>
                      <ThemedText style={styles.sheetCloseText}>×</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.sendFields}>
                    <View style={styles.sendField}>
                      <ThemedText style={styles.inputLabel}>TO</ThemedText>
                      <TextInput
                        autoFocus
                        onChangeText={setTo}
                        placeholder="Someone special"
                        placeholderTextColor="#8f8c84"
                        style={styles.sendInput}
                        value={to}
                      />
                    </View>
                    <View style={styles.sendField}>
                      <ThemedText style={styles.inputLabel}>FROM</ThemedText>
                      <TextInput
                        onChangeText={setFrom}
                        placeholder="Your name"
                        placeholderTextColor="#8f8c84"
                        style={styles.sendInput}
                        value={from}
                      />
                    </View>
                  </View>
                  {error ? <ThemedText style={styles.sendError}>{error}</ThemedText> : null}
                  <Pressable
                    disabled={sending}
                    onPress={() => void sendPostcard()}
                    style={({ pressed }) => [
                      styles.sendButton,
                      (pressed || sending) && styles.pressed,
                    ]}>
                    {sending ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <ThemedText style={styles.sendButtonText}>Send postcard</ThemedText>
                        <ThemedText style={styles.sendButtonArrow}>→</ThemedText>
                      </>
                    )}
                  </Pressable>
                  <ThemedText style={styles.sendNote}>
                    Your drawing, photos, text and stickers stay exactly where you placed them.
                  </ThemedText>
                </View>
              </KeyboardAvoidingView>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#ecebe7',
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#fffefa',
    borderBottomColor: '#d8d6cf',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: 14,
    zIndex: 10,
  },
  iconButton: {
    alignItems: 'center',
    borderColor: '#dedcd5',
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topIcon: {
    color: '#252525',
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 28,
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginLeft: 12,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#f4d83f',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
    width: 34,
  },
  brandMarkText: {
    color: '#1e1e1e',
    fontFamily: Fonts.serif,
    fontSize: 19,
    fontWeight: '900',
  },
  brandName: {
    color: '#262626',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  sideTabs: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 6,
    left: '50%',
    position: 'absolute',
    transform: [{ translateX: -108 }],
    width: 216,
  },
  sideTab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    flex: 1,
    justifyContent: 'center',
    paddingTop: 3,
  },
  sideTabActive: {
    borderBottomColor: '#fb5e3d',
  },
  sideTabText: {
    color: '#77736b',
    fontSize: 15,
    fontWeight: '700',
  },
  sideTabTextActive: {
    color: '#202020',
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  actionGlyph: {
    color: '#33322f',
    fontSize: 20,
  },
  doneButton: {
    alignItems: 'center',
    backgroundColor: '#1d1d1f',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    marginLeft: 4,
    paddingHorizontal: 19,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.32,
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
  },
  workspaceCompact: {
    flexDirection: 'column-reverse',
  },
  toolRail: {
    alignItems: 'center',
    backgroundColor: '#fffefa',
    borderRightColor: '#d8d6cf',
    borderRightWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 18,
    width: 88,
    zIndex: 5,
  },
  toolRailCompact: {
    borderRightWidth: 0,
    borderTopColor: '#d8d6cf',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 74,
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingTop: 4,
    width: '100%',
  },
  toolButton: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 60,
    width: 58,
  },
  toolButtonActive: {
    backgroundColor: '#fff2ed',
    borderColor: '#f4c3b7',
  },
  toolIcon: {
    color: '#373632',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 25,
  },
  toolLabel: {
    color: '#6c6961',
    fontSize: 10,
    fontWeight: '700',
  },
  toolTextActive: {
    color: '#ea5436',
  },
  stage: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  contextBar: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#f7f6f2',
    borderBottomColor: '#d8d6cf',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 18,
  },
  contextCopy: {
    flex: 1,
    minWidth: 110,
  },
  eyebrow: {
    color: '#969188',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
    lineHeight: 12,
  },
  contextTitle: {
    color: '#34332f',
    fontFamily: Fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  contextActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  contextActionScroll: {
    flexGrow: 0,
    maxWidth: '72%',
  },
  colorDot: {
    borderColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 2,
    height: 19,
    width: 19,
  },
  colorDotActive: {
    borderColor: '#252525',
    borderWidth: 3,
    transform: [{ scale: 1.12 }],
  },
  sizePill: {
    alignItems: 'center',
    backgroundColor: '#e8e6df',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    marginLeft: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  sizePreview: {
    borderRadius: 8,
  },
  sizePillText: {
    color: '#44423d',
    fontSize: 10,
    fontWeight: '800',
  },
  smallAction: {
    alignItems: 'center',
    backgroundColor: '#e8e6df',
    borderRadius: 8,
    height: 31,
    justifyContent: 'center',
    width: 31,
  },
  smallActionText: {
    color: '#31302d',
    fontSize: 18,
    fontWeight: '700',
  },
  rotateAction: {
    color: '#31302d',
    fontSize: 17,
  },
  deleteAction: {
    backgroundColor: '#fee8e3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteActionText: {
    color: '#c43f27',
    fontSize: 10,
    fontWeight: '900',
  },
  replaceButton: {
    backgroundColor: '#e5e3dc',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replaceButtonText: {
    color: '#33322e',
    fontSize: 11,
    fontWeight: '800',
  },
  sameToolsNote: {
    color: '#77736a',
    fontSize: 10,
    fontWeight: '700',
  },
  canvasScroll: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
  },
  canvasShadow: {
    aspectRatio: 3 / 2,
    borderRadius: 3,
    maxWidth: '100%',
    shadowColor: '#171712',
    shadowOffset: { height: 15, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
  },
  canvasDrawing: {
    shadowColor: '#fc5d3d',
    shadowOpacity: 0.22,
  },
  cardCanvas: {
    aspectRatio: 3 / 2,
    backgroundColor: '#d1cdc1',
    borderColor: '#ffffff',
    borderRadius: 3,
    borderWidth: 5,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  cardCanvasBack: {
    backgroundColor: '#fffaf0',
    borderColor: '#f6f0e4',
  },
  photoWash: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'rgba(13, 20, 22, 0.08)',
  },
  canvasElement: {
    position: 'absolute',
  },
  canvasTextInput: {
    fontFamily: Platform.select({ ios: 'Snell Roundhand', default: Fonts.serif }),
    fontStyle: 'italic',
    fontWeight: '700',
    minHeight: 46,
    padding: 5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 5,
  },
  stickerElement: {
    borderColor: 'transparent',
    borderRadius: 5,
    borderWidth: 1.5,
    padding: 4,
  },
  photoElement: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 5,
    minHeight: 70,
    minWidth: 95,
    overflow: 'hidden',
  },
  selectedElement: {
    borderColor: '#fdf44b',
    borderRadius: 4,
    borderStyle: 'dashed',
    borderWidth: 2,
  },
  dragHandle: {
    alignItems: 'center',
    backgroundColor: '#fdf44b',
    borderColor: '#252525',
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -9,
    top: -9,
    width: 20,
  },
  dragHandleText: {
    color: '#242424',
    fontSize: 11,
    fontWeight: '900',
  },
  strokeSegment: {
    borderRadius: 99,
    position: 'absolute',
  },
  strokeDot: {
    borderRadius: 99,
    position: 'absolute',
  },
  drawingBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.72)',
    borderRadius: 14,
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
  },
  penDot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  drawingBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  backing: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backPostmark: {
    left: '7%',
    position: 'absolute',
    top: '7%',
    transform: [{ rotate: '-4deg' }],
  },
  postmarkAir: {
    color: '#c15b4a',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  postmarkPlace: {
    color: '#9c9384',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  backDivider: {
    backgroundColor: '#d9d1c3',
    bottom: '9%',
    left: '53%',
    position: 'absolute',
    top: '9%',
    width: 1,
  },
  backStamp: {
    alignItems: 'center',
    backgroundColor: '#fbf5e9',
    borderColor: '#df755e',
    borderStyle: 'dashed',
    borderWidth: 2,
    height: '28%',
    justifyContent: 'center',
    position: 'absolute',
    right: '6%',
    top: '8%',
    width: '14%',
  },
  stampBird: {
    color: '#d55840',
    fontFamily: Fonts.serif,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 28,
  },
  stampValue: {
    color: '#d55840',
    fontSize: 6,
    fontWeight: '900',
  },
  addressBlock: {
    bottom: '18%',
    gap: 11,
    position: 'absolute',
    right: '7%',
    width: '34%',
  },
  addressLabel: {
    color: '#9c9384',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  addressLine: {
    backgroundColor: '#c9c0b2',
    height: 1,
    width: '100%',
  },
  cardSerial: {
    bottom: '4%',
    color: '#aaa192',
    fontSize: 6,
    fontWeight: '800',
    left: '6%',
    letterSpacing: 1.2,
    position: 'absolute',
  },
  stageFooter: {
    alignItems: 'center',
    bottom: 9,
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    position: 'absolute',
  },
  statusGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  savedDot: {
    backgroundColor: '#2bac7b',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  footerText: {
    color: '#78756e',
    fontSize: 9,
    fontWeight: '700',
  },
  stickerPopover: {
    backgroundColor: '#fffefa',
    borderColor: '#d9d5cc',
    borderRadius: 16,
    borderWidth: 1,
    left: 14,
    padding: 14,
    position: 'absolute',
    shadowColor: '#111111',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    top: 96,
    width: 236,
    zIndex: 20,
  },
  stickerPopoverCompact: {
    bottom: 12,
    left: 12,
    top: 'auto',
  },
  popoverHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  popoverTitle: {
    color: '#2b2a27',
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  popoverClose: {
    color: '#6a675f',
    fontSize: 22,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  stickerChoice: {
    alignItems: 'center',
    backgroundColor: '#f0eee8',
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stickerChoiceText: {
    fontSize: 23,
  },
  pressed: {
    opacity: 0.65,
  },
  toast: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#292826',
    borderRadius: 12,
    bottom: 20,
    flexDirection: 'row',
    gap: 14,
    maxWidth: 480,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
  },
  toastText: {
    color: '#ffffff',
    flex: 1,
    fontSize: 12,
  },
  toastClose: {
    color: '#ffffff',
    fontSize: 20,
  },
  modalScrim: {
    bottom: 0,
    backgroundColor: 'rgba(22, 21, 18, 0.55)',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sendSheet: {
    alignSelf: 'center',
    backgroundColor: '#fffefa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 18,
    maxWidth: 620,
    paddingBottom: Platform.select({ ios: 30, default: 24 }),
    paddingHorizontal: 26,
    paddingTop: 10,
    width: '100%',
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#d6d2c9',
    borderRadius: 3,
    height: 5,
    width: 42,
  },
  sendHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sendEyebrow: {
    color: '#e85b3e',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sendTitle: {
    color: '#25241f',
    fontFamily: Fonts.serif,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  sheetClose: {
    alignItems: 'center',
    borderColor: '#dedbd3',
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sheetCloseText: {
    color: '#353430',
    fontSize: 23,
  },
  sendFields: {
    flexDirection: 'row',
    gap: 12,
  },
  sendField: {
    flex: 1,
    gap: 5,
  },
  inputLabel: {
    color: '#777269',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sendInput: {
    backgroundColor: '#f1efe9',
    borderColor: '#d9d5cc',
    borderRadius: 11,
    borderWidth: 1,
    color: '#292824',
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  sendError: {
    color: '#c8442e',
    fontSize: 12,
    fontWeight: '700',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#f25d3d',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 20,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  sendButtonArrow: {
    color: '#ffffff',
    fontSize: 22,
  },
  sendNote: {
    color: '#8b877e',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
