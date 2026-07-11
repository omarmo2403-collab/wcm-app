import { Ionicons } from '@expo/vector-icons';
import Stack from 'expo-router/stack';
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
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { colors, radii, spacing } from '@/theme/tokens';

/** Prototype #screen-ask-scholar: green hero + name/email/question form. */
export default function AskScholarScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const valid =
    name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && question.trim().length > 5;

  const submit = async () => {
    if (!valid || state === 'sending') return;
    setState('sending');
    const { error } = await supabase.from('scholar_questions').insert({
      name: name.trim(),
      email: email.trim(),
      question: question.trim(),
    });
    if (error) {
      setState('error');
    } else {
      track('scholar_question_submitted', {});
      setState('sent');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Ask the Scholar' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Ionicons name="help-circle" size={42} color={colors.textOnPrimary} />
            <Text style={styles.heroTitle}>Ask the Scholar</Text>
            <Text style={styles.heroSub}>Looking for some advice? Ask the Scholar about it.</Text>
          </View>

          {state === 'sent' ? (
            <View style={styles.card}>
              <Ionicons name="checkmark-circle" size={40} color={colors.primary} style={styles.sentIcon} />
              <Text style={styles.sentTitle}>Question submitted</Text>
              <Text style={styles.sentBody}>
                JazakAllah khair — the Scholar will respond to {email.trim()} insha&apos;Allah.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Text style={styles.label}>Your Question</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Type your question here..."
                placeholderTextColor={colors.textMuted}
                value={question}
                onChangeText={setQuestion}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
              {state === 'error' && (
                <Text style={styles.error}>Couldn&apos;t submit — please check your connection and try again.</Text>
              )}
              <Pressable
                style={({ pressed }) => [styles.button, (!valid || pressed) && styles.buttonDim]}
                onPress={submit}
                disabled={!valid || state === 'sending'}
                accessibilityLabel="Submit question"
              >
                {state === 'sending' ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Submit Question</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.screenBackground },

  hero: { backgroundColor: colors.primary, padding: 24, alignItems: 'center' },
  heroTitle: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '700', marginTop: 8 },
  heroSub: { color: colors.textOnPrimary, opacity: 0.9, fontSize: 13, marginTop: 4, textAlign: 'center' },

  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    margin: spacing.lg,
    padding: spacing.lg,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.cardBackground,
  },
  textarea: { minHeight: 110 },
  error: { color: '#C0392B', fontSize: 13, marginTop: spacing.md },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  buttonDim: { opacity: 0.6 },
  buttonText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '700' },

  sentIcon: { alignSelf: 'center' },
  sentTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 8 },
  sentBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
