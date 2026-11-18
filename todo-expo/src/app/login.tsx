import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DEMO_PASSWORD, DEMO_USERNAME, useAuth } from '@/auth';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const { confirmationRequired } = await signUp(email, password);
        if (confirmationRequired) {
          setNotice('Account created. Check your email to confirm your account, then sign in.');
        }
      } else {
        await signIn(email, password);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to authenticate with Supabase.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Todo App</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create an account to save your todos' : 'Sign in to continue'}
        </Text>

        <TextInput
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
            setNotice(null);
          }}
          placeholder={isSignUp ? 'Email' : 'Email or demo username'}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="email"
        />
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          placeholder={isSignUp ? 'Password (at least 6 characters)' : 'Password'}
          secureTextEntry
          onSubmitEditing={() => void submit()}
          style={styles.input}
          testID="password"
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting || !email.trim() || !password}
          onPress={() => void submit()}
          style={[styles.button, (isSubmitting || !email.trim() || !password) && styles.buttonDisabled]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setIsSignUp((current) => !current);
            setError(null);
            setNotice(null);
          }}
        >
          <Text style={styles.switchMode}>
            {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Text>
        </Pressable>
        {!isSignUp ? (
          <Text style={styles.hint}>Demo login: {DEMO_USERNAME} / {DEMO_PASSWORD}</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f1f5f9' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    gap: 12,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#64748b', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  error: { color: '#dc2626' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  notice: { color: '#166534', fontSize: 14 },
  switchMode: { color: '#2563eb', textAlign: 'center', marginTop: 8, fontWeight: '600' },
  hint: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 4 },
});
