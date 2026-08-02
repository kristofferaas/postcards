import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { apiUrl, getPostcards, type Postcard } from '@/api/postcards';
import { PostcardListCard } from '@/components/postcard-list-card';
import { POSTCARD_ASPECT_RATIO } from '@/components/skia-postcard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_CARD_WIDTH = 560;
const DECK_STRIDE_RATIO = 0.72;

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const scrollY = useSharedValue(0);
  const [postcards, setPostcards] = useState<readonly Postcard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);

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

  const measureHeader = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(event.nativeEvent.layout.height);
  }, []);

  const renderPostcard = useCallback(
    ({ index, item }: ListRenderItemInfo<Postcard>) => (
      <PostcardListCard
        cardHeight={cardHeight}
        cardWidth={cardWidth}
        index={index}
        isLast={index === postcards.length - 1}
        itemOffset={headerHeight + index * stride}
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
      headerHeight,
      postcards.length,
      reducedMotion,
      scrollY,
      stride,
      viewportHeight,
    ],
  );

  const header = (
    <View onLayout={measureHeader} style={styles.headerShell}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.mark}>
            <ThemedText style={styles.markText}>P</ThemedText>
          </View>
          <ThemedText type="smallBold">POST CARDS</ThemedText>
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <ThemedText style={styles.title} type="title">
              Your postcard stack.
            </ThemedText>
            <ThemedText style={styles.subtitle} themeColor="textSecondary">
              Scroll through the collection.
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/explore')}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.createButtonText} type="smallBold">
              + Create
            </ThemedText>
          </Pressable>
        </View>

        {error && postcards.length > 0 ? (
          <ThemedView style={styles.inlineError} type="backgroundElement">
            <View style={styles.inlineErrorCopy}>
              <ThemedText type="smallBold">Couldn’t refresh the stack</ThemedText>
              <ThemedText numberOfLines={2} type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadPostcards()}
              style={({ pressed }) => [
                styles.inlineRetry,
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Retry</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}
      </View>
    </View>
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
      <ThemedText type="subtitle">Your first postcard is waiting.</ThemedText>
      <ThemedText style={styles.emptyCopy} themeColor="textSecondary">
        Pick a photo and create your first card.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/explore')}
        style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
        <ThemedText style={styles.createButtonText} type="smallBold">
          Create a postcard
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <Animated.FlatList
        ListEmptyComponent={emptyState}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacing.six,
  },
  headerShell: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  header: {
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.four,
    width: '100%',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: '#f3d949',
    borderCurve: 'continuous',
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
    width: 34,
  },
  markText: {
    color: '#171717',
    fontSize: 20,
    fontWeight: '900',
  },
  titleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  titleCopy: {
    flex: 1,
    gap: Spacing.two,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
  },
  subtitle: {
    lineHeight: 22,
    maxWidth: 500,
  },
  createButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ff5a36',
    borderCurve: 'continuous',
    borderRadius: Spacing.five,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.four,
  },
  createButtonText: {
    color: '#ffffff',
  },
  inlineError: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  inlineErrorCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  inlineRetry: {
    borderColor: 'rgba(127, 127, 127, 0.4)',
    borderCurve: 'continuous',
    borderRadius: Spacing.five,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
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
  emptyCopy: {
    maxWidth: 360,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.68,
  },
});
