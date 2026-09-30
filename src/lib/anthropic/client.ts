import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

// Server-only. Never import this into a Client Component -- the API key
// must never reach the browser.
export function getAnthropicClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}
