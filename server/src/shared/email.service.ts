import nodemailer from "nodemailer";
import Mailjet from "node-mailjet";
import { env } from "../config/env";

const mailjet = Mailjet.apiConnect(env.MJ_APIKEY_PUBLIC, env.MJ_APIKEY_PRIVATE);

const LOGO_URL = "https://cdn.jkcdns.com/logo/jksol_120x120.jpg";
const getLogoImgTag = () => `<img src="${LOGO_URL}" width="80" alt="JKSOL Logo" style="display:block;margin:0 auto;" />`;

const getUniqueIdTag = () => `
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 0px; line-height: 0px; mso-hide: all; color: transparent; opacity: 0;">
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>
`;

// Compact HTML payload for email clients without changing structure/styles.
const compactEmailHtml = (html: string) => html.replace(/>\s+/g, ">").replace(/\s+</g, "<").trim();

const getEmailTimestamp = () => new Date().toISOString();

// Determine if Mailjet is correctly configured
const isMailjetConfigured =
  env.MJ_APIKEY_PUBLIC &&
  env.MJ_APIKEY_PUBLIC !== "" &&
  env.MJ_APIKEY_PUBLIC !== "your_public_key" &&
  env.MJ_APIKEY_PRIVATE &&
  env.MJ_APIKEY_PRIVATE !== "" &&
  env.MJ_APIKEY_PRIVATE !== "your_private_key" &&
  env.MJ_APIKEY_PRIVATE !== "* * * * * *";

const transporter = nodemailer.createTransport(
  isMailjetConfigured
    ? {
      host: "in-v3.mailjet.com",
      port: 587,
      secure: false,
      requireTLS: true,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: env.MJ_APIKEY_PUBLIC,
        pass: env.MJ_APIKEY_PRIVATE,
      },
    }
    : {
      service: "gmail",
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    },
);

const getBaseUrl = async (origin: string | null | undefined, envUrl: string, fallbackUrl: string) => {
  if (origin) {
    const cleanOrigin = origin.replace(/\/$/, "");
    if (cleanOrigin.startsWith("http")) {
      return cleanOrigin;
    }
  }

  if (envUrl.includes("localhost")) {
    return envUrl;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(envUrl, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok || response.status < 500) {
      return envUrl;
    }
    console.warn(`[EmailService] Env URL returned status ${response.status}, failing back.`);
  } catch (error) {
    console.warn(`[EmailService] Env URL unreachable (${error instanceof Error ? error.message : String(error)}), falling back to ${fallbackUrl}`);
  }

  return fallbackUrl;
};

export const sendOtpEmail = async (email: string, otp: string) => {
  const sentAt = new Date().toISOString();
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  try {
    const result = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: env.MJ_SENDER_EMAIL,
            Name: "JKSOL Account",
          },
          To: [
            {
              Email: email,
            },
          ],
          Subject: "Your Login OTP",
          HTMLPart: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center; color: #333;">
                <div style="margin-bottom: 20px;">
                   ${getLogoImgTag()}
                </div>
                <h2>Your One Time Password</h2>
                <p>Use the verification code below to complete your login:</p>
                <div style="background:#f4f4f4; padding:15px 30px; border-radius:8px; display:inline-block;">
                  <span style="font-size:32px; font-weight:bold; letter-spacing:5px;">${otp}</span>
                </div>
                <p style="margin-top:20px; font-size:12px; color:#999;">This code will expire in 5 minutes.</p>
                <p style="font-size:11px; color:#999;">Ref: otp-${uniqueId} | ${sentAt}</p>
              </div>
            `,
          Headers: {
            "X-JKSOL-Email-Timestamp": sentAt,
            "X-Entity-Ref-ID": `otp-${uniqueId}`,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Error sending email via Mailjet API:", error);
  }
};


export const sendInvitation = async (
  email: string,
  token: string,
  roleName: string,
  orgId: number,
  orgName: string,
  orgLogo?: string | null,
  expiresIn: string = "7 days",
  origin?: string | null,
  name?: string,
) => {
  const frontendUrl = await getBaseUrl(origin, env.FRONTEND_URL, env.FRONTEND_URL || "http://localhost:5173");
  const inviteLink = `${frontendUrl}/accept-invite?token=${token}`;
  const displayRole = roleName.charAt(0).toUpperCase() + roleName.slice(1);
  const greeting = name ? `Hello ${name},` : "Hello,";
  const sentAt = getEmailTimestamp();
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const mailOptions = {
    from: `"JKSOL Account" <${env.MJ_SENDER_EMAIL}>`,
    to: email,
    subject: `Invitation to Join JKSOL as ${displayRole}`,
    headers: {
      "X-JKSOL-Email-Timestamp": sentAt,
      "X-Entity-Ref-ID": `invite-${uniqueId}`,
    },
    html: compactEmailHtml(`
      <!-- message_unique: invite-${uniqueId}; sent_at: ${sentAt} -->
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center; color: #333;">
        <div style="margin-bottom: 20px;">
           ${getLogoImgTag()}
        </div>
        
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 10px;">You've Been Invited!</h2>
        <p style="font-size: 16px; color: #333; margin-bottom: 10px;">to join JKSOL Account</p>
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
          You have been invited to join&nbsp;<strong>${orgName}</strong>&nbsp;as an&nbsp;<strong>${displayRole}</strong>.
        </p>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
          Click the button below to accept the invitation and set up your account:
        </p>
        
        <div style="margin-bottom: 30px;">
          <a href="${inviteLink}" style="background-color: #000; color: #fff; padding: 15px 30px; display: inline-block; border-radius: 8px; text-decoration: none; font-weight: bold;">Accept Invitation</a>
        </div>
        
        ${getUniqueIdTag()}
        
        <p style="font-size: 12px; color: #999; margin-bottom: 5px;">
          This link will expire in ${expiresIn}.
        </p>
        <p style="font-size: 12px; color: #999;">
          If you did not expect this invitation, you can safely ignore this email.
        </p>

        <p style="font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
