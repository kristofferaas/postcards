import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createAccountWithPasskey,
  PasskeyAccountCreationAvailableError,
  signInWithPasskey,
} from '@/api/auth';
import { Colors, Spacing } from '@/constants/theme';

type Step = 'passkey' | 'name';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [step, setStep] = useState<Step>('passkey');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const canCreateAccount = name.trim().length > 0;

  const continueWithPasskey = async () => {
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithPasskey();
      await onAuthenticated();
    } catch (cause) {
      if (cause instanceof PasskeyAccountCreationAvailableError) {
        setStep('name');
      } else {
        setError(cause instanceof Error ? cause.message : 'Authentication failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const createAccount = async () => {
    if (!canCreateAccount || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await createAccountWithPasskey(name);
      await onAuthenticated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryPasskey = () => {
    if (isSubmitting) return;
    setError(null);
    setStep('passkey');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom, Spacing.four),
            paddingTop: Math.max(insets.top, Spacing.four),
          },
        ]}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.postcardStack} accessibilityElementsHidden>
            <View style={[styles.postcard, styles.postcardBack]} />
            <View style={[styles.postcard, styles.postcardFront]}>
              <SymbolView
                name={{ ios: 'paperplane.fill', android: 'send' }}
                size={38}
                tintColor="#ffffff"
                weight="semibold"
              />
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Post Cards</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your memories, sealed with a passkey.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.copy}>
            <Text style={[styles.heading, { color: colors.text }]}>
              {step === 'passkey' ? 'Continue to Post Cards' : 'Create your account'}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {step === 'passkey'
                ? 'Use a passkey to sign in or create an account.'
                : 'Enter your name to create an account, or try your passkey again.'}
            </Text>
          </View>

          {step === 'name' ? (
            <TextInput
              accessibilityLabel="Your name"
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect={false}
              autoFocus
              editable={!isSubmitting}
              maxLength={80}
              onChangeText={setName}
              onSubmitEditing={createAccount}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
              value={name}
            />
          ) : null}

          {error ? (
            <View accessibilityLiveRegion="polite" style={styles.errorRow}>
              <SymbolView
                name={{ ios: 'exclamationmark.circle.fill', android: 'error' }}
                size={18}
                tintColor="#d63b3b"
              />
              <Text selectable style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityHint={
              step === 'passkey'
                ? 'Uses a passkey saved on this device'
                : 'Creates your account after passkey setup is complete'
            }
            accessibilityLabel={
              step === 'passkey' ? 'Continue with passkey' : 'Create account'
            }
            accessibilityRole="button"
            disabled={(step === 'name' && !canCreateAccount) || isSubmitting}
            onPress={step === 'passkey' ? continueWithPasskey : createAccount}
            style={({ pressed }) => [
              styles.primaryButton,
              ((step === 'name' && !canCreateAccount) || isSubmitting) &&
                styles.primaryButtonDisabled,
              pressed && styles.primaryButtonPressed,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <SymbolView
                name={{ ios: 'person.badge.key.fill', android: 'passkey' }}
                size={22}
                tintColor="#ffffff"
                weight="semibold"
              />
            )}
            <Text style={styles.primaryButtonText}>
              {step === 'passkey' ? 'Continue with passkey' : 'Create account'}
            </Text>
          </Pressable>

          {step === 'name' ? (
            <Pressable
              accessibilityLabel="Try passkey again"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={retryPasskey}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.primaryButtonPressed,
              ]}>
              <Text style={[styles.retryButtonText, { color: colors.text }]}>Try passkey again</Text>
            </Pressable>
          ) : null}

          <Text style={[styles.footnote, { color: colors.textSecondary }]}>
            {step === 'passkey'
              ? 'No passwords, recovery phrases, or verification codes.'
              : 'Your account is created only after you finish passkey setup.'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.five,
  },
  postcardStack: {
    height: 98,
    marginBottom: Spacing.three,
    width: 124,
  },
  postcard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    height: 78,
    justifyContent: 'center',
    position: 'absolute',
    width: 112,
  },
  postcardBack: {
    backgroundColor: '#ffb451',
    left: 10,
    top: 10,
    transform: [{ rotate: '8deg' }],
  },
  postcardFront: {
    backgroundColor: '#208aef',
    boxShadow: '0 14px 30px rgba(32, 138, 239, 0.28)',
    left: 0,
    top: 5,
    transform: [{ rotate: '-7deg' }],
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  card: {
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: 28,
    gap: Spacing.three,
    maxWidth: 480,
    padding: Spacing.three,
    width: '100%',
  },
  copy: { gap: Spacing.one, paddingHorizontal: Spacing.one },
  heading: { fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
  body: { fontSize: 15, lineHeight: 21 },
  input: {
    borderCurve: 'continuous',
    borderRadius: 14,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
  },
  errorRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  errorText: { color: '#d63b3b', flex: 1, fontSize: 14, lineHeight: 19 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#171717',
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonPressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  primaryButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  retryButtonText: { fontSize: 15, fontWeight: '600' },
  footnote: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
