
import { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getOrCreateTvId } from '@/lib/tv-id';
import { ThemedText } from '@/components/themed-text';
import { useTvData } from '@/hooks/use-tv-group';
import AdDisplayScreen from './ad-display';

export default function HomeScreen() {
  const [tvId, setTvId] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchTvId() {
      const id = await getOrCreateTvId();
      setTvId(id);
    }
    fetchTvId();
  }, []);

  // The useTvData hook now handles its own loading state
  const { isLoading, isInGroup, ads, priorityStream } = useTvData(tvId);

  // Initial loading state while getting TV ID or first fetch
  if (isLoading || !tvId) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <ThemedText>Initializing...</ThemedText>
      </View>
    );
  }

  // Once loaded, check if the TV is in a group
  if (isInGroup) {
    return <AdDisplayScreen ads={ads} priorityStream={priorityStream} />;
  }

  // If not in a group, show the registration screen
  return (
    <View style={styles.container}>
      <ThemedText style={styles.instructions}>
        Scan the code with your admin app, or enter the ID below:
      </ThemedText>
      <View style={styles.registrationInfo}>
        <QRCode
          value={tvId}
          size={250}
          backgroundColor='#fff'
          color='#000'
        />
        <ThemedText style={styles.tvId}>{tvId}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    gap: 24,
    padding: 24,
  },
  instructions: {
    fontSize: 22,
    textAlign: 'center',
    color: '#ccc',
  },
  registrationInfo: {
    alignItems: 'center',
    gap: 32,
  },
  tvId: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
});
