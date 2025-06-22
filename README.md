# AudioCodes Bot API SDK 
AudioCodes [LiveHub](https://www.audiocodes.com/solutions-products/saas/audiocodes-live-hub) is a platform that bridges telephony systems with traditional chatBots and conversational AI bots. It allows businesses to automate customer interactions, enhance engagement, and streamline workflows.

This package provides a WebSocket client for the [AudiCodes Bot API](https://techdocs.audiocodes.com/voice-ai-connect/#Bot-API/ac-bot-api-mode-websocket.htm) 
, enabling developers to create bots that can interact with users in real-time over WebSocket connections.

## AC Bot API WebSocket short overview
AC Bot API is a protocol that allows developers to create bots that can interact with users in real-time over WebSocket connections. It provides a way to send and receive text or voice over WebSocket connections.<br><br>

## How to use
The `BotConversationWebSocket` emits the following events:

- **`conversation.start`**: Emitted when a session is initiated.
- **`userStream`**: Emitted when a user stream starts, providing the audio stream and message details.
- **`activity`**: Emitted when an activity is received.
- **`end`**: Emitted when the conversation ends.
- **`error`**: Emitted when an error occurs during message sending.

Here is a sample:
```typescript
import {
  BotConversationWebSocket,
  BotApiWebSocket,
  BotActivity,
  BotActivityEventName,
  BotActivityType
} from '@audiocodes/ac-bot-api';

class TextEchoBot {
  constructor(private botConversation: BotConversationWebSocket) {
    this.botConversation.on('activity', (activity: BotActivity) => {
      this.handleActivity(activity);
    });
    this.botConversation.on('end', (activity) => {
      console.log('Conversation ended:', activity);
    });
  }

  private handleActivity(activity: BotActivity) {
    console.log('Received activity:', JSON.stringify(activity));
    if (activity.type === 'event') {
      if (activity.name === BotActivityEventName.start) {
        this.botConversation.playTextMessage('Welcome to sample webSocket Bot! How can I assist you today?');
        return;
      }
    }
    if (activity.type === 'message' && activity.text) {
      // delete trailing period
      const request = activity.text.toLowerCase().replace(/\.$/u, '');
      if (request === 'disconnect') {
        return this.botConversation.sendActivity([{
          type: BotActivityType.event,
          name: BotActivityEventName.hangup
        }]);
      }
      return this.botConversation.playTextMessage(activity.text);
    }
  }
}

const api = new BotApiWebSocket().listen({
  port: 8081,
  token: process.env.ACCESS_TOKEN || 'TOKEN'
}, () => {
  console.info(`Bot API listening on port ${api.port}`);
});

api.on('conversation', (conversation: BotConversationWebSocket, { initiateMessage }) => {
  console.info(`New conversation started. caller: ${initiateMessage.caller}`);
  new TextEchoBot(conversation);
});

```

See more detailed example in AudioCodes Bot samples [repository](https://github.com/ac-voice-ai/ac-api-samples)


