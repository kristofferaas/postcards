import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { InteractiveSkiaPostcard } from './interactive-skia-postcard';

export function PostcardEditor() {
  const { height, width } = useWindowDimensions();

  return (
    <View
      accessibilityHint="Drag to turn, pinch to zoom, or double-tap to reset"
      accessibilityLabel="Interactive postcard"
      accessibilityRole="image"
      style={styles.screen}>
      <InteractiveSkiaPostcard
        frontImage="fjord"
        height={height}
        width={width}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#ecebe7',
    flex: 1,
  },
});
