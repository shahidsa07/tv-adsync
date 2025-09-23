
import { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getOrCreateTvId } from '@/lib/tv-id';
import { ThemedText } from '@/components/themed-text';


export default function HomeScreen() {
  const [tvId, setTvId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTvId() {
      const id = await getOrCreateTvId();
      setTvId(id);
    }
    fetchTvId();
  }, []);

  return (
    <View style={styles.container}>
      {tvId ? (
        <>
          <ThemedText>Scan to add this TV to the admin server</ThemedText>
          <QRCode value={tvId} size={200} />
          <ThemedText style={styles.tvId}>{tvId}</ThemedText>
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
    gap: 16,
  },
  tvId: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
