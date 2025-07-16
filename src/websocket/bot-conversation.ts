import debug from 'debug';
import { promisify } from 'util';
import WebSocket from 'ws';
import {
  BotActivity,
  BotActivityType,
  BotToVaicMessageName,
  MediaFormat,
  PlayAudioOptions,
  ProtocolMessage,
  VaicToBotMessageName
} from './types.js';
import ee2, { type Listener } from 'eventemitter2';
import { PassThrough, Readable, } from 'stream';
const { EventEmitter2 } = ee2;

const log = debug('ac-bot-api');

function redactMessage(message: ProtocolMessage) {
  if (!message.audioChunk)
    return message;
  return {
    ...message,
    audioChunk: `${message.audioChunk.slice(0, 40)}...`
  };
}


declare interface BotConversationEvents {
  on(event: 'conversation.start', listener: (message: ProtocolMessage) => Promise<void>): this | Listener;
  on(event: 'userStream', listener: (stream: PassThrough, options: { message: ProtocolMessage }) => void): this | Listener;
  on(event: 'activity', listener: (activity: BotActivity) => void): this | Listener;
  on(event: 'end', listener: (message?: ProtocolMessage) => void): this | Listener;
  on(event: 'error', listener: (error: Error) => void): this | Listener;
}
export class BotConversationWebSocket extends EventEmitter2 implements BotConversationEvents {
  private ended = false;
  private conversationId = '';
  private mediaFormat = MediaFormat.RAW_LINEAR_16;
  private recordingSeq = 0;
  private sendBackIncomingVoice?: NodeJS.Timeout;
  private userAudio?: PassThrough;

  constructor(private websocket: WebSocket) {
    super();
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    websocket.on('message', async (message) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const msgStr = message.toString();
      if (msgStr.startsWith('{'))
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          await this.onJson(JSON.parse(msgStr));
        } catch (err) {
          this.#log('Error parsing JSON message:', msgStr, err);
        }
    });
    websocket.on('close', () => {
      this.#log('connection closed');
      this.close();
    });
    websocket.on('error', (err) => {
      this.#log('connection error:', err);
      this.close();
    });
  }

  #log(...args: unknown[]) {
    log(`[${this.conversationId}]`, ...args);
  }

  playAudio(stream: Readable, options?: PlayAudioOptions) {
    const currentId = `play-${this.recordingSeq++}`;
    let streamEnded = false;
    this.send(BotToVaicMessageName.playStreamStart, { mediaFormat: this.mediaFormat, streamId: currentId, ...options })
      .then(() => {
        stream.on('data', (chunk: Buffer | string) => {
          if (streamEnded || this.ended) {
            return;
          }
          this.send(BotToVaicMessageName.playStreamChunk, {
            audioChunk: chunk.toString('base64'),
            streamId: currentId
          }).catch(() => {
            streamEnded = true;
          });
        });
        stream.on('end', () => {
          this.send(BotToVaicMessageName.playStreamStop, { streamId: currentId }).catch(() => {
            streamEnded = true;
          });
          stream.on('error', (error: Error) => {
            streamEnded = true;
            this.#log('Error sending audio stream:', error);
          });
        });
      })
      .catch(() => { });
  }

  close(msgJson?: ProtocolMessage) {
    if (this.ended)
      return
    this.emit('end', msgJson);
    this.websocket.close();
    this.ended = true;
    if (this.sendBackIncomingVoice) {
      clearTimeout(this.sendBackIncomingVoice);
      delete this.sendBackIncomingVoice;
    }
  }

  private async onJson(msgJson: ProtocolMessage) {
    if (msgJson.type !== VaicToBotMessageName.userStreamChunk)
      this.#log('received message:', msgJson.type);
    switch (msgJson.type) {
      case VaicToBotMessageName.sessionInitiate: {
        this.conversationId = msgJson.conversationId!;
        try {
          await this.emitAsync('conversation.start', msgJson);
          await this.send(BotToVaicMessageName.sessionAccepted, {
            mediaFormat: this.mediaFormat
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          this.#log('Error handling conversation.start:', error);
          await this.send(BotToVaicMessageName.sessionError, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            reason: `Error handling conversation.start: ${error.message || error}`,
          });
          this.close();
        }
        break;
      }
      case VaicToBotMessageName.sessionResume:
        if (msgJson.conversationId === this.conversationId)
          await this.send(BotToVaicMessageName.sessionAccepted);
        else
          await this.send(BotToVaicMessageName.sessionError, { conversationId: msgJson.conversationId, reason: 'conversation not found' });
        break;
      case VaicToBotMessageName.userStreamStart:
        this.userAudio = new PassThrough();
        this.emit('userStream', this.userAudio, { message: msgJson });
        await this.send(BotToVaicMessageName.userStreamStarted, { participant: msgJson.participant });
        break;
      case VaicToBotMessageName.userStreamChunk:
        this.userAudio?.write(Buffer.from(msgJson.audioChunk!, 'base64'));
        break;
      case VaicToBotMessageName.userStreamStop:
        this.#log('user stream stopped');
        this.userAudio?.end();
        await this.send(BotToVaicMessageName.userStreamStopped, { participant: msgJson.participant });
        delete this.userAudio;
        break;
      case VaicToBotMessageName.activities:
        for (const activity of msgJson.activities!)
          this.handleActivity(activity);
        break;

      case VaicToBotMessageName.sessionEnd:
        this.close(msgJson);
        break;
      default:
        this.#log('handling unknown message:', msgJson.type);
        break;
    }
  }

  handleActivity(activity: unknown) {
    this.emit('activity', activity);
  }

  async send(type: BotToVaicMessageName, message?: Omit<ProtocolMessage, 'type'>) {
    this.#log(`sending: ${JSON.stringify(redactMessage({ type, ...message }))}`);
    if (this.ended) {
      this.#log('Attempted to send message on ended conversation:', type);
      return;
    }
    try {
      if (this.websocket.readyState !== WebSocket.OPEN)
        throw new Error('WebSocket is not open');
      await promisify(this.websocket.send.bind(this.websocket))(JSON.stringify({
        type,
        ...message
      }));
    } catch (error) {
      this.#log('Error sending message:', error);
      this.emit('error', new Error(`Error sending message: ${type}`, { cause: error }));
      throw error;
    }
  }

  sendHypothesis(text: string, participant?: string) {
    return this.send(BotToVaicMessageName.userStreamSpeechHypothesis, {
      participant,
      alternatives: [{
        text: text.toLowerCase()
      }]
    });
  }

  sendRecognition(text: string, confidence: number, participant?: string) {
    return this.send(BotToVaicMessageName.userStreamSpeechRecognition, {
      participant,
      alternatives: [{
        text: text.toLowerCase(),
        confidence
      }]
    });
  }

  sendCommitted(participant?: string) {
    return this.send(BotToVaicMessageName.userStreamSpeechCommitted, { participant });
  }

  async playTextMessage(text: string, params?: Record<string, unknown>) {
    return this.sendActivity({
      type: BotActivityType.message,
      text,
      activityParams: params
    });
  }

  sendActivity(activity: BotActivity | BotActivity[]) {
    const activities = {
      activities: Array.isArray(activity) ? activity : [activity]
    };
    return this.send(BotToVaicMessageName.activities, activities);
  }
}
