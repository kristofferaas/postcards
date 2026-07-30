import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiUrl, getPostcards, type Postcard } from '@/api/postcards';
import { PostcardPreview } from '@/components/postcard-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

function PostcardDetails({ postcard }: { readonly postcard: Postcard }) {
  const deliveryStatus = postcard.sentAt ? `Sent ${formatDate(postcard.sentAt)}` : 'Draft';
  const openStatus = postcard.openedAt ? `Opened ${formatDate(postcard.openedAt)}` : 'Waiting to open';

  return (
    <ThemedView type="backgroundElement" style={styles.details}>
      <View style={styles.detailTop}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>{postcard.to.slice(0, 1).toUpperCase()}</ThemedText>
        </View>
        <View style={styles.detailNames}>
          <ThemedText type="smallBold">For {postcard.to}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            from {postcard.from}
          </ThemedText>
        </View>
        <View style={[styles.statusPill, postcard.openedAt && styles.statusPillOpened]}>
          <ThemedText style={styles.statusText} type="smallBold">
            {postcard.openedAt ? 'OPENED' : 'SENT'}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.content}>{postcard.content}</ThemedText>

      <View style={styles.metadata}>
        <ThemedText type="small" themeColor="textSecondary">
          {deliveryStatus}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {openStatus}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

function PostcardPicker({
  postcards,
  selectedId,
  onSelect,
}: {
  readonly postcards: readonly Postcard[];
  readonly selectedId: number;
  readonly onSelect: (id: number) => void;
}) {
  return (
    <View style={styles.collection}>
      <ThemedText type="smallBold">YOUR POSTCARDS</ThemedText>
      <ScrollView
        horizontal
        contentContainerStyle={styles.pickerContent}
        showsHorizontalScrollIndicator={false}
        style={styles.picker}>
        {postcards.map((postcard) => {
          const selected = postcard.id === selectedId;

          return (
            <Pressable
              accessibilityLabel={`Show postcard to ${postcard.to}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={postcard.id}
              onPress={() => onSelect(postcard.id)}
              style={({ pressed }) => [
                styles.pickerItem,
                selected && styles.pickerItemSelected,
                pressed && styles.pressed,
              ]}>
              <PostcardPreview compact design={postcard} side="front" />
              <View style={styles.pickerMeta}>
                <ThemedText numberOfLines={1} type="smallBold">
                  {postcard.to}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {postcard.sentAt ? formatDate(postcard.sentAt) : 'Draft'}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [postcards, setPostcards] = useState<readonly Postcard[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPostcards = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const nextPostcards = await getPostcards(signal);
      setPostcards(nextPostcards);
      setSelectedId((currentId) => {
        if (currentId !== null && nextPostcards.some(({ id }) => id === currentId)) {
          return currentId;
        }
        return nextPostcards[0]?.id ?? null;
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Could not load postcards.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void loadPostcards(controller.signal);
      return () => controller.abort();
    }, [loadPostcards]),
  );

  const selectedPostcard =
    postcards.find((postcard) => postcard.id === selectedId) ?? postcards[0];

  const selectPostcard = (id: number) => {
    setSelectedId(id);
    setSide('front');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.mark}>
                <ThemedText style={styles.markText}>P</ThemedText>
              </View>
              <ThemedText type="smallBold">POST CARDS</ThemedText>
            </View>
            <ThemedText style={styles.title} type="title">
              Made with feeling.{'\n'}Sent in a tap.
            </ThemedText>
            <View style={styles.headerBottom}>
              <ThemedText style={styles.subtitle} themeColor="textSecondary">
                Turn a favorite moment into something worth keeping.
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/explore')}
                style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
                <ThemedText style={styles.createButtonText} type="smallBold">
                  + Create
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {selectedPostcard ? (
            <>
              <View style={styles.heroCard}>
                <Pressable
                  accessibilityHint="Flips between the front and back"
                  accessibilityLabel={`Postcard ${side}`}
                  onPress={() => setSide((current) => (current === 'front' ? 'back' : 'front'))}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <PostcardPreview design={selectedPostcard} side={side} />
                </Pressable>
                <View style={styles.flipBar}>
                  <View>
                    <ThemedText type="smallBold">
                      {side === 'front' ? 'The photo side' : 'The note side'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Tap the postcard to flip it
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSide((current) => (current === 'front' ? 'back' : 'front'))}
                    style={styles.flipButton}>
                    <ThemedText style={styles.flipIcon}>↻</ThemedText>
                    <ThemedText type="smallBold">Flip</ThemedText>
                  </Pressable>
                </View>
              </View>

              <PostcardPicker
                onSelect={selectPostcard}
                postcards={postcards}
                selectedId={selectedPostcard.id}
              />
              <PostcardDetails postcard={selectedPostcard} />
            </>
          ) : loading ? (
            <ActivityIndicator color={theme.text} size="large" style={styles.state} />
          ) : error ? (
            <ThemedView type="backgroundElement" style={styles.stateCard}>
              <ThemedText type="smallBold">Could not reach the postcard server</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary">
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
            <View style={styles.empty}>
              <ThemedText style={styles.emptyMark}>💌</ThemedText>
              <ThemedText type="subtitle">Your first postcard is waiting.</ThemedText>
              <ThemedText themeColor="textSecondary">
                Pick a photo, add your note, and send a little joy.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/explore')}
                style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
                <ThemedText style={styles.createButtonText} type="smallBold">
                  Create a postcard
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingTop: 0,
    width: '100%',
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: '#f3d949',
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
  title: {
    fontSize: 43,
    lineHeight: 47,
  },
  headerBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  subtitle: {
    flex: 1,
    lineHeight: 22,
    maxWidth: 450,
  },
  createButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ff5a36',
    borderRadius: Spacing.five,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.four,
  },
  createButtonText: {
    color: '#ffffff',
  },
  heroCard: {
    gap: Spacing.three,
  },
  flipBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flipButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderRadius: Spacing.five,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  flipIcon: {
    fontSize: 20,
  },
  collection: {
    gap: Spacing.three,
  },
  picker: {
    marginHorizontal: -Spacing.four,
  },
  pickerContent: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  pickerItem: {
    borderColor: 'transparent',
    borderRadius: Spacing.three,
    borderWidth: 2,
    gap: Spacing.two,
    padding: 3,
    width: 180,
  },
  pickerItemSelected: {
    borderColor: '#ff5a36',
  },
  pickerMeta: {
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.one,
  },
  details: {
    borderRadius: Spacing.four,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  detailTop: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#f3d949',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginRight: Spacing.two,
    width: 40,
  },
  avatarText: {
    color: '#171717',
    fontSize: 17,
    fontWeight: '900',
  },
  detailNames: {
    flex: 1,
  },
  statusPill: {
    backgroundColor: 'rgba(255,90,54,0.14)',
    borderRadius: Spacing.five,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillOpened: {
    backgroundColor: 'rgba(11,122,117,0.16)',
  },
  statusText: {
    color: '#b83b22',
    fontSize: 9,
    letterSpacing: 1.1,
    lineHeight: 12,
  },
  content: {
    fontSize: 18,
    lineHeight: 28,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  state: {
    marginTop: Spacing.five,
    textAlign: 'center',
  },
  stateCard: {
    alignItems: 'center',
    borderRadius: Spacing.four,
    gap: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.four,
  },
  retryButton: {
    borderColor: 'currentColor',
    borderRadius: Spacing.five,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  emptyMark: {
    fontSize: 54,
  },
  pressed: {
    opacity: 0.68,
  },
});
