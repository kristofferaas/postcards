import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiUrl, getPostcards, type Postcard } from '@/api/postcards';
import { PostcardListCard } from '@/components/postcard-list-card';
import { POSTCARD_ASPECT_RATIO } from '@/components/skia-postcard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_CARD_WIDTH = 560;
const DECK_STRIDE_RATIO = 0.72;
const CREATE_BUTTON_HEIGHT = 56;

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const scrollY = useSharedValue(0);
  const [postcards, setPostcards] = useState<readonly Postcard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cardWidth = Math.min(
    MAX_CARD_WIDTH,
    Math.max(1, viewportWidth - Spacing.four * 2),
  );
  const cardHeight = cardWidth / POSTCARD_ASPECT_RATIO;
  const stride = reducedMotion
    ? cardHeight + Spacing.three
    : cardHeight * DECK_STRIDE_RATIO;

  const loadPostcards = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      setPostcards(await getPostcards(signal));
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setError(
        cause instanceof Error ? cause.message : 'Could not load postcards.',
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void loadPostcards(controller.signal);
      return () => controller.abort();
    }, [loadPostcards]),
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const renderPostcard = useCallback(
    ({ index, item }: ListRenderItemInfo<Postcard>) => (
      <PostcardListCard
        cardHeight={cardHeight}
        cardWidth={cardWidth}
        index={index}
        isLast={index === postcards.length - 1}
        itemOffset={index * stride}
        postcard={item}
        reducedMotion={reducedMotion}
        scrollY={scrollY}
        stride={stride}
        viewportHeight={viewportHeight}
      />
    ),
    [
      cardHeight,
      cardWidth,
      postcards.length,
      reducedMotion,
      scrollY,
      stride,
      viewportHeight,
    ],
  );

  const emptyState = loading ? (
    <View style={styles.state}>
      <ActivityIndicator color={theme.text} size="large" />
      <ThemedText themeColor="textSecondary">Gathering your postcards…</ThemedText>
    </View>
  ) : error ? (
    <ThemedView style={styles.errorCard} type="backgroundElement">
      <ThemedText type="subtitle">Could not reach the postcard server</ThemedText>
      <ThemedText themeColor="textSecondary">{error}</ThemedText>
      <ThemedText selectable type="code" themeColor="textSecondary">
        {apiUrl}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => void loadPostcards()}
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
        <ThemedText type="smallBold">Try again</ThemedText>
      </Pressable>
    </ThemedView>
  ) : (
    <View style={styles.state}>
      <ThemedText themeColor="textSecondary">No postcards yet.</ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.FlatList
        ListEmptyComponent={emptyState}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              insets.bottom + CREATE_BUTTON_HEIGHT + Spacing.four * 2,
          },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        data={postcards}
        initialNumToRender={6}
        keyExtractor={(postcard) => postcard.id.toString()}
        maxToRenderPerBatch={6}
        onRefresh={() => void loadPostcards()}
        onScroll={onScroll}
        refreshing={loading && postcards.length > 0}
        removeClippedSubviews={false}
        renderItem={renderPostcard}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />

      <View
        pointerEvents="box-none"
        style={[styles.createButtonOverlay, { bottom: insets.bottom + Spacing.three }]}>
        <Pressable
          accessibilityHint="Opens the postcard editor"
          accessibilityLabel="Create postcard"
          accessibilityRole="button"
          onPress={() => router.push('/explore')}
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.createButtonPressed,
          ]}>
          <SymbolView
            name={{
              ios: 'rectangle.on.rectangle.angled',
              android: 'cards',
            }}
            size={21}
            tintColor="#ffffff"
            weight="semibold"
          />
          <ThemedText style={styles.createButtonText}>Create</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    alignItems: 'center',
  },
  createButtonOverlay: {
    alignItems: 'center',
    height: CREATE_BUTTON_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: CREATE_BUTTON_HEIGHT / 2,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
    flexDirection: 'row',
    gap: Spacing.two,
    height: CREATE_BUTTON_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  createButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  state: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  errorCard: {
    alignItems: 'center',
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: Spacing.four,
    gap: Spacing.three,
    maxWidth: 560,
    padding: Spacing.four,
    width: '86%',
  },
  retryButton: {
    borderColor: 'rgba(127, 127, 127, 0.5)',
    borderCurve: 'continuous',
    borderRadius: Spacing.five,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.68,
  },
});
