// A tool as the page shows it: what the server tells an assistant about it, read from @rebodocs/mcp when the site is built.

export interface ParamDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enum?: string[];
}

export interface ToolDoc {
  name: string;
  description: string;
  /** True when it changes the document. */
  writes: boolean;
  /** True when it can be told to work on the header, the footer, a note or a text box. */
  areas: boolean;
  params: ParamDoc[];
}
