import {
  BottomSheet,
  BottomSheetView,
} from '@expo/ui/community/bottom-sheet';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ProfileSettingsDrawerProps = {
  isOpen: boolean;
  isSigningOut: boolean;
  name: string;
  onDismiss: () => void;
  onSignOut: () => void;
};

export function ProfileSettingsDrawer({
  isOpen,
  isSigningOut,
  name,
  onDismiss,
  onSignOut,
}: ProfileSettingsDrawerProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <BottomSheet
      backgroundStyle={{ backgroundColor: theme.background }}
      enablePanDownToClose
      index={isOpen ? 0 : -1}
      onClose={onDismiss}>
      <BottomSheetView
        style={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, Spacing.four) },
        ]}>
        <ThemedText style={styles.title}>Settings</ThemedText>

        <View
          accessibilityLabel={`Signed in as ${name}`}
          style={[
            styles.profileCard,
            { backgroundColor: theme.backgroundElement },
          ]}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.backgroundSelected },
            ]}>
            <SymbolView
              name={{ ios: 'person.fill', android: 'person' }}
              size={24}
              tintColor={theme.text}
            />
          </View>
          <ThemedText selectable style={styles.name}>
            {name}
          </ThemedText>
        </View>

        <Pressable
          accessibilityHint="Signs out of Post Cards"
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed,
            isSigningOut && styles.signOutButtonDisabled,
          ]}>
          {isSigningOut ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <SymbolView
              name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout' }}
              size={20}
              tintColor="#ffffff"
              weight="semibold"
            />
          )}
          <ThemedText style={styles.signOutButtonText}>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </ThemedText>
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  profileCard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 20,
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 76,
    padding: Spacing.three,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: '#d63b3b',
    borderRadius: 28,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  signOutButtonDisabled: {
    opacity: 0.7,
  },
  signOutButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  signOutButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
