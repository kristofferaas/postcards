import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { postcardImageUrl } from '@/api/postcards';
import { usePostcardDesigns } from '@/state/postcards';

import { InteractiveSkiaPostcard } from './interactive-skia-postcard';

export function PostcardEditor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { designs, error, isInitialLoading, refresh } = usePostcardDesigns();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const design = designs[0];
  const frontImage = design ? postcardImageUrl(design.frontImageUri) : null;
  const loadError =
    error ??
    (!isInitialLoading && design === undefined
      ? 'No postcard designs. Run pnpm data:seed.'
      : null);

  return (
    <View style={styles.screen}>
      <View
        accessibilityHint="Drag to turn, pinch to zoom, or double-tap to reset"
        accessibilityLabel="Interactive postcard"
        accessibilityRole="image"
        style={styles.postcard}>
        <InteractiveSkiaPostcard
          frontImage={frontImage}
          height={height}
          width={width}
        />
      </View>

      {loadError ? (
        <Text selectable style={styles.loadError}>
          {loadError}
        </Text>
      ) : null}

      <Pressable
        accessibilityHint="Returns to the postcard list"
        accessibilityLabel="Close editor"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => router.replace('/')}
        style={({ pressed }) => [
          styles.toolbarButton,
          styles.closeButton,
          { top: insets.top + 12 },
          pressed && styles.toolbarButtonPressed,
        ]}>
        <Text style={styles.closeIcon}>×</Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Send postcard"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => undefined}
        style={({ pressed }) => [
          styles.toolbarButton,
          styles.sendButton,
          { top: insets.top + 12 },
          pressed && styles.toolbarButtonPressed,
        ]}>
        <Text style={styles.sendButtonText}>Send</Text>
        <SymbolView
          name={{ ios: 'paperplane.fill', android: 'send' }}
          size={17}
          tintColor="#ffffff"
          weight="semibold"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#ecebe7',
    flex: 1,
  },
  postcard: {
    flex: 1,
  },
  loadError: {
    alignSelf: 'center',
    color: '#6b6359',
    maxWidth: 320,
    position: 'absolute',
    textAlign: 'center',
    top: '52%',
  },
  toolbarButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 1,
  },
  toolbarButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    left: 16,
    width: 44,
  },
  closeIcon: {
    color: '#171717',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },
  sendButton: {
    backgroundColor: '#171717',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    right: 16,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
