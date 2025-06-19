import Stream from 'stream';

export enum BotActivityType {
  message = 'message',
  event = 'event'
}

export enum BotActivityEventName {
  hangup = 'hangup',
  transfer = 'transfer',
  config = 'config',
  playUrl = 'playUrl',
  start = 'start',
  startRecognition = 'startRecognition',
  stopRecognition = 'stopRecognition',
  sendMetaData = 'sendMetaData',
  startCallRecording = 'startCallRecording',
  stopCallRecording = 'stopCallRecording',
  pauseCallRecording = 'pauseCallRecording',
  resumeCallRecording = 'resumeCallRecording',
  speakerVerificationCreateSpeaker = 'speakerVerificationCreateSpeaker',
  speakerVerificationGetSpeakerStatus = 'speakerVerificationGetSpeakerStatus',
  speakerVerificationDeleteSpeaker = 'speakerVerificationDeleteSpeaker',
  speakerVerificationEnroll = 'speakerVerificationEnroll',
  speakerVerificationVerify = 'speakerVerificationVerify',
  abortPrompts = 'abortPrompts',
  expectAnotherBotMessage = 'expectAnotherBotMessage',
  sendDtmf = 'sendDtmf'
}
export interface BaseActivity {
  activityParams?: Record<string, unknown>;
  sessionParams?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  value?: unknown;
  delay?: number;
  id?: string;
  timestamp?: string;
}

export interface BotActivityParticipant {
  participant: string;
  uriUser: string;
  uriHost: string;
  displayName: string;
}

export interface MessageActivity extends BaseActivity {
  type: BotActivityType.message;
  text: string;
}

export interface EventActivity extends BaseActivity {
  type: BotActivityType.event;
  name: BotActivityEventName;
}

export type BotActivity = MessageActivity | EventActivity;

export enum VaicToBotMessageName {
  sessionInitiate = 'session.initiate',
  sessionResume = 'session.resume',
  sessionEnd = 'session.end',
  activities = 'activities',
  userStreamStart = 'userStream.start',
  userStreamChunk = 'userStream.chunk',
  userStreamStop = 'userStream.stop'
}

export enum BotToVaicMessageName {
  sessionAccepted = 'session.accepted',
  sessionError = 'session.error',
  activities = 'activities',
  userStreamStarted = 'userStream.started',
  userStreamStopped = 'userStream.stopped',
  userStreamSpeechHypothesis = 'userStream.speech.hypothesis',
  userStreamSpeechRecognition = 'userStream.speech.recognition',
  userStreamSpeechStarted = 'userStream.speech.started',
  userStreamSpeechStopped = 'userStream.speech.stopped',
  userStreamSpeechCommitted = 'userStream.speech.committed',
  playStreamStart = 'playStream.start',
  playStreamChunk = 'playStream.chunk',
  playStreamStop = 'playStream.stop'
}

export interface PlayAudioOptions {
  altText?: string;
  activityParams?: Record<string, unknown>;
  mediaFormat?: string;
};

export interface ProtocolMessage extends PlayAudioOptions {
  type: VaicToBotMessageName | BotToVaicMessageName;
  conversationId?: string;
  expectAudioMessages?: boolean;
  supportedMediaFormats?: string[];
  caller?: string;
  activities?: BotActivity[];
  audioChunk?: string;
  [key: string]: unknown;
};
