const conversations = {}; // In-memory storage for demonstration

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export async function getConversationHistory(fromNumber) {
  if (conversations[fromNumber]) {
    return conversations[fromNumber].messages;
  }
  return [];
}

export async function saveMessageToHistory(fromNumber, message) {
  if (!conversations[fromNumber]) {
    conversations[fromNumber] = { messages: [], lastActive: Date.now() };
  }
  conversations[fromNumber].messages.push(message);
  conversations[fromNumber].lastActive = Date.now();
}

// Clean up old sessions
setInterval(() => {
  const now = Date.now();
  for (const number in conversations) {
    if (now - conversations[number].lastActive > SESSION_TIMEOUT) {
      delete conversations[number];
    }
  }
}, SESSION_TIMEOUT);
