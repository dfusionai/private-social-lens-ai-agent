export enum DataSource {
  // Chat system sources
  CHAT_USER_MESSAGE = 'chat_user_message',
  CHAT_ASSISTANT_RESPONSE = 'chat_assistant_response',
  CHAT_STREAM_ASSISTANT_RESPONSE = 'chat_stream_assistant_response',

  // Document upload sources
  DOCUMENT_UPLOAD = 'document_upload',
  USER_UPLOAD = 'user_upload',

  // Message import sources (by platform)
  TELEGRAM_MESSAGE = 'telegram_message',
  WHATSAPP_MESSAGE = 'whatsapp_message',
  DISCORD_MESSAGE = 'discord_message',
  SLACK_MESSAGE = 'slack_message',
  MESSENGER_MESSAGE = 'messenger_message',

  // Custom sources
  COMPANY_POLICY = 'company_policy',
  COMPANY_DIRECTORY = 'company_directory',
  PROJECT_SPECS = 'project_specs',
  MEETING_NOTES = 'meeting_notes',

  // Unknown/fallback
  UNKNOWN = 'unknown',
}
