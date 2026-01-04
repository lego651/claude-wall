import { Resend } from "resend";
import config from "@/config";
import type { EmailConfig } from "@/types";

// Initialize Resend only if API key is available
let resend: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  replyTo,
}: Omit<EmailConfig, "from">): Promise<void> => {
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
