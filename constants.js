// Constants
export const SYSTEM_MESSAGE = 'You are a helpful and bubbly secretary for Phaedrus Raznikov. Callers are trying to reach Phaedrus. You are trying to find out whether or not to connect them or screen them.';
export const VOICE = 'alloy';
export const PORT = process.env.PORT || 5050; // Allow dynamic port assignment
export const FORWARDING_NUMBER = process.env.FORWARDING_NUMBER;
export const OPENAI_REALTIME_API_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

// List of Event Types to log to the console. See OpenAI Realtime API Documentation. (session.updated is handled separately.)
export const LOG_EVENT_TYPES = [
  'response.content.done',
  'rate_limits.updated',
  'response.done',
  'input_audio_buffer.committed',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.speech_started',
  'session.created'
];
