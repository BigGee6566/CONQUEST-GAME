import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError, messageOf } from '../api/client';
import { Logo } from '../components/Brand';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, ErrorBanner, TextField } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, font, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;
type Mode = 'login' | 'register';
type Errors = Partial<Record<'identifier' | 'username' | 'email' | 'password', string>>;

// Mirrors the server's Zod rules so most mistakes are caught before a request is sent.
function validate(mode: Mode, form: { identifier: string; username: string; email: string; password: string }): Errors {
  const errors: Errors = {};
  if (mode === 'login') {
    if (form.identifier.trim().length < 3) errors.identifier = 'Enter your username or email';
    if (!form.password) errors.password = 'Enter your password';
    return errors;
  }
  if (!/^[A-Za-z0-9_]{3,20}$/.test(form.username.trim())) {
    errors.username = '3-20 letters, numbers or underscores';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address';
  if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
    errors.password = 'At least 8 characters, with a letter and a number';
  }
  return errors;
}

export function AuthScreen({ navigation, route }: Props) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(route.params?.mode ?? 'login');
  const [form, setForm] = useState({ identifier: '', username: '', email: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    const found = validate(mode, form);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === 'login') await login(form.identifier.trim(), form.password);
      else await register(form.username.trim(), form.email.trim(), form.password);
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Main');
    } catch (err) {
      if (err instanceof ApiError && err.details.length > 0) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])) as Errors);
      }
      setServerError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen maxWidth={460}>
      <View style={styles.hero}>
        <Logo width={190} />
        <Text style={styles.tagline}>Ten nations. One world. Roll for it.</Text>
      </View>
      <Card>
        <View style={styles.tabs}>
          <Chip label="Log in" selected={mode === 'login'} onPress={() => { setMode('login'); setErrors({}); }} />
          <Chip label="Create account" selected={mode === 'register'} onPress={() => { setMode('register'); setErrors({}); }} />
        </View>

        {serverError && <ErrorBanner message={serverError} onDismiss={() => setServerError(null)} />}

        {mode === 'login' ? (
          <TextField
            label="Username or email"
            value={form.identifier}
            onChangeText={update('identifier')}
            error={errors.identifier}
            autoComplete="username"
            textContentType="username"
            onSubmitEditing={submit}
          />
        ) : (
          <>
            <TextField label="Username" value={form.username} onChangeText={update('username')} error={errors.username} autoComplete="username" maxLength={20} />
            <TextField label="Email" value={form.email} onChangeText={update('email')} error={errors.email} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          </>
        )}
        <TextField
          label="Password"
          value={form.password}
          onChangeText={update('password')}
          error={errors.password}
          secureTextEntry
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          maxLength={72}
          onSubmitEditing={submit}
        />
        <Button label={mode === 'login' ? 'Log in' : 'Create account'} icon="log-in" onPress={submit} loading={submitting} />
        <Text style={styles.hint}>
          {mode === 'login'
            ? 'You can watch any shared game without an account. Log in to play your own.'
            : 'Your profile tracks every campaign, battle and conquest.'}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  tagline: { color: colors.textMuted, fontSize: font.body },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: font.small, textAlign: 'center' },
});
