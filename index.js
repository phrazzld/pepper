import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import Fastify from 'fastify';
import WebSocket from 'ws';
import { OPENAI_API_KEY } from './config.js';
import { FORWARDING_NUMBER, LOG_EVENT_TYPES, OPENAI_REALTIME_API_URL, PORT, SYSTEM_MESSAGE, VOICE } from './constants.js';
import { twilioClient } from './twilio-client.js';

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Root Route
fastify.get('/', async (_request, reply) => {
  reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming and outgoing calls
// <Say> punctuation to improve text-to-speech translation
fastify.all('/incoming-call', async (request, reply) => {
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
  fastify.get('/media-stream', { websocket: true }, (connection, _req) => {
    console.log('Client connected');

    const openAiWs = new WebSocket(OPENAI_REALTIME_API_URL, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    let streamSid = null;
    let callSid = null;

    const sendSessionUpdate = () => {
      const sessionUpdate = {
        type: 'session.update',
        session: {
          turn_detection: { type: 'server_vad' },
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          voice: VOICE,
          instructions: SYSTEM_MESSAGE,
          modalities: ["text", "audio"],
          temperature: 0.8,

          tools: [
            {
              name: 'hangUp',
              description: 'Hang up the call',
              type: 'function',
              parameters: {
                type: 'object',
                properties: {
                  reason: {
                    type: 'string',
                    description: 'Reason for hanging up the call',
                  },
                },
                required: ['reason'],
              },
            },
            {
              name: 'forwardCall',
              description: 'Forward the call to another phone number',
              type: 'function',
              parameters: {
                type: 'object',
                properties: {
                  to: {
                    type: 'string',
                    description: 'The phone number to forward the call to in E.164 format',
                  },
                  reason: {
                    type: 'string',
                    description: 'Reason for forwarding the call',
                  },
                },
                required: ['to'],
              },
            },
          ],
        }
      };

      console.log('Sending session update:', JSON.stringify(sessionUpdate));
      openAiWs.send(JSON.stringify(sessionUpdate));
    };

    // Open event for OpenAI WebSocket
    openAiWs.on('open', () => {
      console.log('Connected to the OpenAI Realtime API');
      setTimeout(() => {
        sendSessionUpdate();
        // Send a message to the OpenAI WebSocket to initialize the conversation
        openAiWs.send(JSON.stringify({
          type: 'input.text',
          text: 'Hello'
        }))
      }, 250); // Ensure connection stability, send after .25 seconds
    });

    // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
    openAiWs.on('message', (data) => {
      try {
        const response = JSON.parse(data);

        if (response.type === 'response.output_item.done' && response.item.type === 'function_call') {
          const { name, arguments: args } = response.item;
          console.log('Received function call:', name, args);

          if (name === 'hangUp') {
            const hangupReason = args.reason;
            console.log('Hanging up call:', hangupReason);

            // Hang up the call via Twilio REST API
            if (callSid) {
              twilioClient.calls(callSid)
                .update({ status: 'completed' })
                .then(_call => console.log(`Call ${callSid} has been hung up.`))
                .catch(error => console.error('Error hanging up the call:', error));
            } else {
              console.error('callSid is not available. Cannot hang up the call.');
            }
          } else if (name === 'forwardCall') {
            if (callSid) {
              twilioClient.calls(callSid).update({
                twiml: `<Response>
                  <Say>Transferring your call now.</Say>
                  <Dial>${FORWARDING_NUMBER}</Dial>
                </Response>`,
              });
            }
          }
        }

        if (LOG_EVENT_TYPES.includes(response.type)) {
          console.log(`Received event: ${response.type}`, response);
        }

        if (response.type === 'session.updated') {
          console.log('Session updated successfully:', response);
        }

        if (response.type === 'response.audio.delta' && response.delta) {
          const audioDelta = {
            event: 'media',
            streamSid: streamSid,
            media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
          };
          connection.send(JSON.stringify(audioDelta));
        }
      } catch (error) {
        console.error('Error processing OpenAI message:', error, 'Raw message:', data);
      }
    });

    // Handle incoming messages from Twilio
    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'media':
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              };

              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;
          case 'start':
            streamSid = data.start.streamSid;
            callSid = data.start.callSid;
            console.log('Incoming stream has started', streamSid, callSid);
            break;
          default:
            console.log('Received non-media event:', data.event);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error, 'Message:', message);
      }
    });

    // Handle connection close
    connection.on('close', () => {
      if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
      console.log('Client disconnected.');
    });

    // Handle WebSocket close and errors
    openAiWs.on('close', () => {
      console.log('Disconnected from the OpenAI Realtime API');
    });

    openAiWs.on('error', (error) => {
      console.error('Error in the OpenAI WebSocket:', error);
    });
  });
});

fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server is listening on port ${PORT}`);
});
