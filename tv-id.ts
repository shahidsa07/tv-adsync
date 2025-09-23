
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const TV_ID_KEY = 'tv-id';

export async function getOrCreateTvId(): Promise<string> {
  let tvId = await SecureStore.getItemAsync(TV_ID_KEY);
  if (tvId) {
    return tvId;
  }
  tvId = Crypto.randomUUID();
  await SecureStore.setItemAsync(TV_ID_KEY, tvId);
  return tvId;
}
