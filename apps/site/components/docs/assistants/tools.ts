// The tools, read from the source of @rebodocs/mcp when the site is built: what
// the page lists is what the server tells an assistant, and cannot drift from it.

import { TOOLS } from '@rebodocs/mcp';
import { TOOL_GROUPS } from './data';
import type { ToolDoc } from './types';

type Schema = { type?: string; description?: string; enum?: string[]; items?: { type?: string } };

export function toolDocs(): ToolDoc[] {
  const docs = TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    writes: tool.writes,
    areas: !!tool.areas,
    params: Object.entries(tool.properties as Record<string, Schema>).map(([name, schema]) => ({
      name,
      type: schema.type === 'array' && schema.items?.type ? `${schema.items.type}[]` : (schema.type ?? 'any'),
      required: (tool.required ?? []).includes(name),
      description: schema.description ?? '',
      ...(schema.enum ? { enum: schema.enum } : {}),
    })),
  }));
  // A tool added to the server and not to a group would be missing from the page: the build says so.
  const grouped = new Set(TOOL_GROUPS.flatMap((group) => group.tools));
  const missing = docs.filter((tool) => !grouped.has(tool.name)).map((tool) => tool.name);
  if (missing.length) throw new Error(`Tools in no group of components/docs/assistants/data.ts: ${missing.join(', ')}`);
  return docs;
}
