import debug from 'debug';
import http, { IncomingMessage } from 'node:http';
import { EventEmitter } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { BotConversationWebSocket } from './bot-conversation.js';
import { ProtocolMessage } from './types.js';

const log = debug('ac-bot-api');

export interface BotApiServerOptions {
  server?: http.Server;
  host?: string;
  port?: number;
  token?: string;
}

export class BotApiWebSocket extends EventEmitter {
  private server?: http.Server;
  #port = 8080;

  get port() {
    return this.#port;
  }

  listen(options?: BotApiServerOptions, callback?: () => void): BotApiWebSocket {
    this.server = options?.server || http.createServer();
    if (options?.port)
      this.#port = options.port;

    this.server.keepAliveTimeout = 30000;
    this.server.listen(this.#port, options?.host, callback);
    const webSockServer = new WebSocketServer({
      perMessageDeflate: false,
      server: this.server,
      verifyClient: (info: { req: IncomingMessage }) => {
        // Verify the client has the correct authorization token
        return !options?.token || info.req.headers.authorization === `Bearer ${options.token}`;
      }
    });
    webSockServer.on('connection', (websocket: WebSocket, request: IncomingMessage) => {
      const conversation = new BotConversationWebSocket(websocket);
      conversation.on('conversation.start', (initiateMessage: ProtocolMessage) => {
        this.emit('conversation', conversation, { request, initiateMessage });
      });
    });

    return this;
  }

  close() {
    if (this.server?.listening) {
      this.server.close(() => {
        log('Bot API server closed.');
      });
    }
  }
}
