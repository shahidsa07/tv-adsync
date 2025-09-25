
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

  const { isLoading, isInGroup, ads, priorityStream } = useTvData(tvId);

  if (isLoading || !tvId) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <ThemedText>Initializing...</ThemedText>
      </View>
    );
  }

  if (isInGroup) {
    // The `ads` array is now passed to the correctly implemented AdDisplayScreen.
    // A check for `ads` is kept as a safeguard against race conditions.
    if (ads) {
      return <AdDisplayScreen ads={ads} priorityStream={priorityStream} tvId={tvId} />;
    } else {
      // This handles the brief moment before the first ad data is available.
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#fff" />
          <ThemedText>Loading ad data...</ThemedText>
        </View>
      );
    }
  }

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
    lineHeight: 60, // Added to prevent text clipping
  },
});
