import fastifyFormBody from '@fastify/formbody'
import fastifyWs from '@fastify/websocket'
import dotenv from 'dotenv'
import Fastify from 'fastify'
import WebSocket from 'ws'

dotenv.config()

const { OPENAI_API_KEY } = process.env
if (!OPENAI_API_KEY) {
  console.error("Missing OpenAI API key. Please set it in the .env file.");
  process.exit(1)
}

const fastify = Fastify();
fastify.register(fastifyFormBody)
fastify.register(fastifyWs)

const SYSTEM_MESSAGE = 'You are a helpful and bubbly AI assistant.'
const VOICE = 'nova'
const PORT = process.env.PORT || 5050;

const LOG_EVENT_TYPES = [
  'response.content.done',
  'rate_limits.updated',
  'response.done',
  'input_audio_buffer.committed',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.speech_started',
  'session.created'
];

fastify.get('/', async (_request, reply) => {
  reply.send({ message: "Twilio Media Stream Server is running!" })
})

fastify.all('/incoming-call', async (request, reply) => {
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8" ?>
                          <Response>
                            <Say>Please wait while we connect your call.</Say>
                            <Pause length="1" />
                            <Say>O. K. you can start talking!</Say>
                            <Connect>
                              <Stream url="wss://${request.headers.host}/media-stream" />
                            </Connect>
                          </Response>`
  reply.type("text/xml").send(twimlResponse)
})

fastify.register(async (fastify) => {
  fastify.get('/media-stream', { websocket: true }, (connection, _req) => {
    console.log("Client connected")

    const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    let streamSid = null;

    const sendSessionUpdate = () => {
      const sessionUpdate = {
        type: "session.update",
        session: {
          turn_detection: { type: "server_vad" },
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          voice: VOICE,
          instructions: SYSTEM_MESSAGE,
          modalities: ["text", "audio"],
          temperature: 0.8,
        }
      }

      console.log("Sending session update:", JSON.stringify(sessionUpdate))
      openAiWs.send(JSON.stringify(sessionUpdate))
    }

    openAiWs.on("open", () => {
      console.log("OpenAI WebSocket connection established")
      setTimeout(sendSessionUpdate, 250)
    })

    openAiWs.on("message", (data) => {
      try {
        const response = JSON.parse(data)

        if (LOG_EVENT_TYPES.includes(response.type)) {
          console.log(`Received event: ${response.type}`, response)
        }

        if (response.type === 'session.updated') {
          console.log("Session updated:", response);
        }

        if (response.type === "response.audio.delta" && response.delta) {
          const audioDelta = {
            event: "media",
            streamSid: streamSid,
            media: {
              payload: Buffer.from(response.delta, "base64").toString("base64"),
            }
          }
          console.log("Sending audio delta:", JSON.stringify(audioDelta))
          connection.send(JSON.stringify(audioDelta))
        }
      } catch (error) {
        console.error("Error parsing OpenAI WebSocket message:", error, "Raw message:", data)
      }
    })

    connection.on("message", (message) => {
      try {
        const data = JSON.parse(message)

        switch (data.event) {
          case "media":
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: "input_audio_buffer.append",
                audio: data.media.payload
              }

              openAiWs.send(JSON.stringify(audioAppend))
            }
            break;
          case "start":
            streamSid = data.start.streamSid;
            console.log("Incoming stream has started", streamSid);
            break;
          default:
            console.log("Unknown event", data.event);
        }
      } catch (error) {
        console.error("Error parsing Twilio WebSocket message:", error, "Raw message:", message)
      }
    })

    connection.on("close", () => {
      if (openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.close()
      }
      console.log("Client disconnected")
    })

    openAiWs.on("close", () => {
      console.log("OpenAI WebSocket connection closed")
    })

    openAiWs.on("error", (error) => {
      console.error("OpenAI WebSocket error:", error)
    })
  })
})

fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  console.log(`Server listening on port ${PORT}`);
})
