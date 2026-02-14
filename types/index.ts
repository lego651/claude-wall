import Stripe from "stripe";

// Config Types
export interface StripePlan {
  priceId: string;
  name: string;
  description?: string;
  price: number;
  priceAnchor?: number;
  isFeatured?: boolean;
  features: Array<{
    name: string;
  }>;
}

export interface AppConfig {
  appName: string;
  appDescription: string;
  domainName: string;
  crisp: {
    id?: string;
    onlyShowOnRoutes?: string[];
  };
  stripe: {
    plans: StripePlan[];
  };
  aws?: {
    bucket: string;
    bucketUrl: string;
    cdn: string;
  };
  resend: {
    fromNoReply: string;
    fromAdmin: string;
    supportEmail?: string;
  };
  colors: {
    theme: string;
    main: string;
  };
  auth: {
    loginUrl: string;
    callbackUrl: string;
  };
}

// Database Types
export interface Profile {
  id: string;
  email: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  wallet_address?: string;
  customer_id?: string;
  price_id?: string;
  has_access?: boolean;
  created_at?: string;
  updated_at?: string;
}

// API Request/Response Types
export interface CreateCheckoutRequest {
  priceId: string;
  mode: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
  couponId?: string;
}

export interface CreateCheckoutResponse {
  url: string;
}

export interface CreatePortalRequest {
  returnUrl: string;
}

export interface CreatePortalResponse {
  url: string;
}

export interface LeadRequest {
  email: string;
}

export interface LeadResponse {
  success: boolean;
}

// Stripe Webhook Types
export interface StripeWebhookEvent {
  type: string;
  data: {
    object: Stripe.Event.Data.Object;
  };
}

// Supabase User with Metadata
export interface UserMetadata {
  avatar_url?: string;
  name?: string;
  email?: string;
}

// Re-export the Supabase User type directly
export type { User as SupabaseUser } from "@supabase/supabase-js";

// Email Types
export interface EmailConfig {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

// SEO Types
export interface SEOParams {
  title?: string;
  description?: string;
  canonicalUrlRelative?: string;
  extraTags?: Record<string, string>;
}

// Study/Timeline Types
export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  summary: string;
  type: "weekly" | "governance" | "milestone";
  details?: {
    pl?: number;
    trades?: number;
    metrics?: Array<{
      label: string;
      value: string;
    }>;
    notes?: string;
  } | null;
}
