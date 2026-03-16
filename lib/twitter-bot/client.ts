/**
 * Twitter API v2 client for posting tweets.
 *
 * Uses OAuth 1.0a user-context authentication (required for posting).
 * Reads credentials from env vars — throws clearly if any are missing.
 *
 * Env vars required:
 *   TWITTER_API_KEY             — consumer key (API key)
 *   TWITTER_API_SECRET          — consumer secret (API secret)
 *   TWITTER_ACCESS_TOKEN        — access token for the bot account
 *   TWITTER_ACCESS_TOKEN_SECRET — access token secret for the bot account
 *
 * Free tier (v2): 1,500 tweets/month write limit. We post ~30/month.
 */

import { TwitterApi } from "twitter-api-v2";

export interface PostTweetResult {
  tweetId: string;
}

function getClient(): TwitterApi {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    const missing = [
      !apiKey && "TWITTER_API_KEY",
      !apiSecret && "TWITTER_API_SECRET",
      !accessToken && "TWITTER_ACCESS_TOKEN",
      !accessTokenSecret && "TWITTER_ACCESS_TOKEN_SECRET",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(`Missing Twitter API credentials: ${missing}`);
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken,
    accessSecret: accessTokenSecret,
  });
}

/**
 * Post a tweet and return the tweet ID.
 * Throws on API error or missing credentials.
 */
export async function postTweet(text: string): Promise<PostTweetResult> {
  if (!text || text.trim().length === 0) {
    throw new Error("Tweet text cannot be empty");
  }
  if (text.length > 280) {
    throw new Error(`Tweet text too long: ${text.length} chars (max 280)`);
  }

  const client = getClient();
  const response = await client.v2.tweet(text);
  const tweetId = response.data?.id;

  if (!tweetId) {
    throw new Error("Twitter API returned no tweet ID");
  }

  return { tweetId };
}
