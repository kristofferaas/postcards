import { Image, type ImageSource } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';

import type { CreatePostcardInput } from '@/api/postcards';
import { Fonts, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';

const fjordImage = require('@/assets/images/postcards/norway-fjord.jpg');

export const postcardImageSource = (frontImage: string): ImageSource =>
  frontImage === 'fjord' ? fjordImage : { uri: frontImage };

type PreviewSide = 'front' | 'back';

type PostcardPreviewProps = {
  readonly design: CreatePostcardInput;
  readonly side: PreviewSide;
  readonly compact?: boolean;
};

const captionStyles = StyleSheet.create({
  classic: {
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bold: {
    fontFamily: Fonts.rounded,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  script: {
    fontFamily: Platform.select({ ios: 'Snell Roundhand', default: Fonts.serif }),
    fontStyle: 'italic',
    fontWeight: '700',
  },
});

const stickerPositions = [
  { left: '7%', top: '10%', transform: [{ rotate: '-10deg' }] },
  { bottom: '8%', right: '8%', transform: [{ rotate: '8deg' }] },
  { right: '13%', top: '12%', transform: [{ rotate: '5deg' }] },
  { bottom: '12%', left: '14%', transform: [{ rotate: '-7deg' }] },
] as const;

export function PostcardPreview({ compact = false, design, side }: PostcardPreviewProps) {
  if (side === 'front') {
    return (
      <View style={[styles.card, compact && styles.compactCard]}>
        <Image
          contentFit="cover"
          source={postcardImageSource(design.frontImage)}
          style={StyleSheet.absoluteFill}
          transition={180}
        />
        <View style={styles.photoShade} />

        {design.caption ? (
          <ThemedText
            numberOfLines={2}
            style={[
              styles.caption,
              compact && styles.captionCompact,
              captionStyles[design.captionStyle as keyof typeof captionStyles] ??
                captionStyles.classic,
            ]}>
            {design.caption}
          </ThemedText>
        ) : null}

        {design.stickers.map((sticker, index) => (
          <ThemedText
            key={`${sticker}-${index}`}
            style={[
              styles.sticker,
              compact && styles.stickerCompact,
              stickerPositions[index % stickerPositions.length],
            ]}>
            {sticker}
          </ThemedText>
        ))}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        styles.back,
        compact && styles.compactCard,
        { borderColor: design.accentColor },
      ]}>
      <View style={styles.messageColumn}>
        <ThemedText
          numberOfLines={compact ? 4 : 6}
          style={[styles.handwriting, compact && styles.handwritingCompact]}>
          {design.content || 'Write something wonderful…'}
        </ThemedText>
        <View style={styles.fromLine}>
          <ThemedText style={styles.tinyLabel}>WITH LOVE FROM</ThemedText>
          <ThemedText numberOfLines={1} style={styles.fromName}>
            {design.from || 'Your name'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.addressColumn}>
        <View style={[styles.stamp, { borderColor: design.accentColor }]}>
          <ThemedText style={compact ? styles.stampEmojiCompact : styles.stampEmoji}>
            {design.stamp}
          </ThemedText>
          <ThemedText style={[styles.stampText, { color: design.accentColor }]}>POST</ThemedText>
        </View>

        <View style={styles.addressLines}>
          <ThemedText style={styles.tinyLabel}>DELIVER TO</ThemedText>
          <ThemedText numberOfLines={1} style={styles.toName}>
            {design.to || 'Someone special'}
          </ThemedText>
          {[0, 1, 2].map((line) => (
            <View key={line} style={styles.addressLine} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 3 / 2,
    backgroundColor: '#e9e5da',
    borderRadius: Spacing.four,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  compactCard: {
    borderRadius: Spacing.three,
  },
  photoShade: {
    backgroundColor: 'rgba(9, 13, 20, 0.12)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  caption: {
    bottom: '9%',
    color: '#ffffff',
    fontSize: 28,
    left: '8%',
    lineHeight: 32,
    maxWidth: '78%',
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.48)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 8,
  },
  captionCompact: {
    fontSize: 17,
    lineHeight: 20,
  },
  sticker: {
    fontSize: 32,
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 3,
  },
  stickerCompact: {
    fontSize: 21,
  },
  back: {
    backgroundColor: '#fffaf0',
    borderWidth: 2,
    flexDirection: 'row',
    padding: '6%',
  },
  messageColumn: {
    flex: 1.05,
    justifyContent: 'space-between',
    paddingRight: '5%',
  },
  handwriting: {
    color: '#2e3a38',
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 27,
  },
  handwritingCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  fromLine: {
    gap: 2,
  },
  tinyLabel: {
    color: '#8c8579',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  fromName: {
    color: '#2e3a38',
    fontFamily: Fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
  },
  divider: {
    backgroundColor: '#ded7ca',
    width: 1,
  },
  addressColumn: {
    flex: 0.95,
    justifyContent: 'space-between',
    paddingLeft: '6%',
  },
  stamp: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    aspectRatio: 0.84,
    backgroundColor: '#ffffff',
    borderStyle: 'dashed',
    borderWidth: 2,
    justifyContent: 'center',
    width: '34%',
  },
  stampEmoji: {
    fontSize: 23,
  },
  stampEmojiCompact: {
    fontSize: 14,
  },
  stampText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  addressLines: {
    gap: 7,
  },
  toName: {
    color: '#2e3a38',
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  addressLine: {
    backgroundColor: '#c8c0b4',
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
