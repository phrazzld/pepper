import OpenAI from 'openai'
import { getConversationHistory, saveMessageToHistory } from './conversation.js';
import { OPENAI_API_KEY } from './config.js';

// Initialize OpenAI API client
const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
})

// Define the assistant's behavior
const SYSTEM_PROMPT = "You are Pepper, an AI assistant for Phaedrus Raznikov's office. You handle SMS messages professionally and helpfully.";

export async function processIncomingSms(fromNumber, message) {
  // Retrieve conversation history
  const history = await getConversationHistory(fromNumber);

  // Construct the conversation messages
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: message },
  ];

  // Call OpenAI's Chat Completion API
  const response = await client.chat.completions.create({
    model: 'gpt-3.5-turbo', // Or the latest available model
    messages: messages,
    temperature: 0.7,
  });

  // Extract the assistant's reply
  const reply = response.choices[0].message.content;

  // Save the conversation
  await saveMessageToHistory(fromNumber, { role: 'user', content: message });
  await saveMessageToHistory(fromNumber, { role: 'assistant', content: reply });

  return reply;
}
