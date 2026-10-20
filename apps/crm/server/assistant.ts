// The way to Claude, as the CRM's backend would have it: the page sends the
// conversation, and gets back what Claude answered. Here is where a CRM checks
// that whoever asks has a session, with `allow`.

import { assistantRoute } from '../../../packages/mcp/src/claude';

const effort = process.env.ASSISTANT_EFFORT;

export const route = assistantRoute({
  model: process.env.ASSISTANT_MODEL || undefined,
  effort: effort === 'low' || effort === 'medium' || effort === 'high' ? effort : undefined,
  perMinute: Number(process.env.ASSISTANT_PER_MINUTE) || undefined,
});
