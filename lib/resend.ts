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
  from,
  to,
  subject,
  text,
  html,
  replyTo,
}: Omit<EmailConfig, "from"> & { from?: string }): Promise<void> => {
  const resend = getResendClient();

  if (!resend) {
    const msg = "RESEND_API_KEY is not set; cannot send email";
    console.error(msg);
    throw new Error(msg);
  }

  try {
    const emailOptions: any = {
      from: from ?? config.resend.fromNoReply,
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

    const { data, error } = await resend.emails.send(emailOptions);
    if (error) {
      console.error("Resend API error:", error);
      throw new Error(error.message || "Resend send failed");
    }
    if (data?.id) {
      console.log("[Resend] Email sent, id:", data.id);
    }
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};
