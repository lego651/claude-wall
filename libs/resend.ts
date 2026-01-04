import { Resend } from "resend";
import config from "@/config";
import type { EmailConfig } from "@/types";

// Lazy initialization - only create Resend instance when actually sending email
// This prevents build-time errors when env vars aren't available
const getResendClient = (): Resend | null => {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  replyTo,
}: Omit<EmailConfig, "from">): Promise<void> => {
  const resend = getResendClient();

  if (!resend) {
    console.warn("RESEND_API_KEY is not set, skipping email send");
    return;
  }

  try {
    const emailOptions: any = {
      from: config.resend.fromNoReply,
      to,
      subject,
    };

    if (html) {
      emailOptions.html = html;
    }
    if (text) {
      emailOptions.text = text;
    }
    if (replyTo) {
      emailOptions.replyTo = replyTo;
    }

    await resend.emails.send(emailOptions);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};
