/**
 * Chat history persistence, keyed by user email.
 *
 * Each user's messages are stored under `boost_chat_<email>` so that
 * switching accounts on the same device never leaks conversation data.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: number;
}

function storageKey(email: string): string {
  const safe = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return `boost_chat_${safe}`;
}

/** Load the persisted chat history for a given user. */
export function loadChatHistory(email: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(email));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

/** Persist the full chat history for a given user. */
export function saveChatHistory(email: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(messages));
  } catch {
    // Storage full or unavailable — silently drop.
  }
}

/** Clear all stored chat messages for a user. */
export function clearChatHistory(email: string): void {
  localStorage.removeItem(storageKey(email));
}
