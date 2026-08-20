import debug from 'debug';
import http, { IncomingMessage } from 'node:http';
import ee2 from 'eventemitter2';
const { EventEmitter2 } = ee2;
import { WebSocket, WebSocketServer } from 'ws';
import { BotConversationWebSocket } from './bot-conversation.js';
import { ProtocolMessage } from './types.js';

const log = debug('ac-bot-api');

export interface BotApiServerOptions {
  server?: http.Server;
  host?: string;
  port?: number;
  path?: string;
  token?: string;
}

export class BotApiWebSocket extends EventEmitter2 {
  private server?: http.Server;
  private ownServer = false;
  #port = 8080;

  get port() {
    return this.#port;
  }

  listen(options?: BotApiServerOptions, callback?: () => void): BotApiWebSocket {
    this.ownServer = !options?.server;
    this.server = options?.server || http.createServer();
    if (options?.port)
      this.#port = options.port;

    const verifyClient = (info: { req: IncomingMessage; }) => {
      return !options?.token || info.req.headers.authorization === `Bearer ${options.token}`;
    };

    const handleConnection = (websocket: WebSocket, request: IncomingMessage) => {
      const conversation = new BotConversationWebSocket(websocket);
      conversation.on('conversation.start', (initiateMessage: ProtocolMessage) => {
        return this.emitAsync('conversation', conversation, { request, initiateMessage });
      });
    };

    if (options?.path) {
      const webSockServer = new WebSocketServer({
        perMessageDeflate: false,
        noServer: true
      });
      webSockServer.on('connection', handleConnection);
      this.server.on('upgrade', (request: IncomingMessage, socket, head) => {
        const url = new URL(request.url!, `http://${request.headers.host}`);
        if (url.pathname !== options.path)
          return;
        if (!verifyClient({ req: request })) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        webSockServer.handleUpgrade(request, socket, head, (ws) => {
          webSockServer.emit('connection', ws, request);
        });
      });
    } else {
      const webSockServer = new WebSocketServer({
        perMessageDeflate: false,
        server: this.server,
        verifyClient
      });
      webSockServer.on('connection', handleConnection);
    }

    if (this.ownServer) {
      this.server.keepAliveTimeout = 30000;
      this.server.listen(this.#port, options?.host, callback);
    }

    return this;
  }

  close() {
    if (this.ownServer && this.server?.listening) {
      this.server.close(() => {
        log('Bot API server closed.');
      });
    }
  }
}
