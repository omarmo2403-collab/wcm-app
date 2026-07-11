import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: in release builds an uncaught render error would
 * otherwise close the app instantly with no message. This shows the error
 * so it can be reported and fixed.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.text}>
            Please screenshot this and send it to the app team:
          </Text>
          <Text style={styles.error}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack?.slice(0, 800)}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 80 },
  title: { fontSize: 20, fontWeight: '700', color: '#c0392b' },
  text: { fontSize: 14, color: '#333', marginTop: 8 },
  error: { fontSize: 12, color: '#666', marginTop: 16, fontFamily: 'monospace' },
});
