export const env = {
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-key',
  JWT_EXPIRES_IN: '1d',
  SMTP_USER: process.env.SMTP_USER || 'jksol.admin@gmail.com',
  SMTP_PASS: process.env.SMTP_PASS || "teob leqv gdmm yjhn",
  MJ_APIKEY_PUBLIC: process.env.MJ_APIKEY_PUBLIC || '',
  MJ_APIKEY_PRIVATE: process.env.MJ_APIKEY_PRIVATE || '',
  MJ_SENDER_EMAIL: process.env.MJ_SENDER_EMAIL || process.env.SMTP_USER || '',
  BASE_URL: process.env.BASE_URL || '',
  FRONTEND_URL: process.env.FRONTEND_URL || '',
};
