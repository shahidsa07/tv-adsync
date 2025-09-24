
import { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getOrCreateTvId } from '@/lib/tv-id';
import { ThemedText } from '@/components/themed-text';
import { useTvData } from '@/hooks/use-tv-group';
import AdDisplayScreen from './ad-display';

export default function HomeScreen() {
  const [tvId, setTvId] = useState<string | null>(null);
  const { isInGroup, ads, priorityStream } = useTvData(tvId);

  useEffect(() => {
    async function fetchTvId() {
      const id = await getOrCreateTvId();
      setTvId(id);
    }
    fetchTvId();
  }, []);

  if (isInGroup) {
    return <AdDisplayScreen ads={ads} priorityStream={priorityStream} />;
  }

  return (
    <View style={styles.container}>
      {tvId ? (
        <>
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
        </>
      ) : (
        <ThemedText>Generating TV ID...</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  instructions: {
    fontSize: 22,
    textAlign: 'center',
    color: '#ccc',
    marginBottom: 32,
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
