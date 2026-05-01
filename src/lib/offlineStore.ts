export const OFFLINE_STORAGE_KEY = 'qr_currency_offline_intents';

export interface OfflineIntent {
  id: string;
  type: 'claim' | 'transfer';
  data: {
    qrId?: string;
    tokenId?: string;
  };
  timestamp: number;
}

export function saveOfflineIntent(intent: Omit<OfflineIntent, 'id' | 'timestamp'>) {
  const intents = getOfflineIntents();
  const newIntent: OfflineIntent = {
    ...intent,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  intents.push(newIntent);
  localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(intents));
  return newIntent;
}

export function getOfflineIntents(): OfflineIntent[] {
  try {
    const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function removeOfflineIntent(id: string) {
  const intents = getOfflineIntents().filter(i => i.id !== id);
  localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(intents));
}

export function clearOfflineIntents() {
  localStorage.removeItem(OFFLINE_STORAGE_KEY);
}
