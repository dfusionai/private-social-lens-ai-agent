import ms from 'ms';

export type AuthConfig = {
  secret?: string;
  expires?: ms.StringValue;
  refreshSecret?: string;
  refreshExpires?: ms.StringValue;
  forgotSecret?: string;
  forgotExpires?: ms.StringValue;
  confirmEmailSecret?: string;
  confirmEmailExpires?: ms.StringValue;
  telegramApiId?: string;
  telegramApiHash?: string;
  telegramDcId?: string;
  telegramDcHost?: string;
  telegramDcPort?: string;
  apiKey?: string;
};
