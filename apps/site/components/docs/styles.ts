// Class names the pages of the documentation share. Not in `ui.tsx`: a server
// component that imports a constant from a client module gets a reference, not the string.

/** Code coloured by Shiki on the server, on the warm grey of the page. Several blocks one under another. */
export const CODE =
  '[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-[10px] [&_pre]:bg-surface! [&_pre]:px-5 [&_pre]:py-4 [&_pre]:font-code [&_pre]:text-[13.5px] [&_pre]:leading-[1.7] [&_pre+pre]:mt-2';
/** The small capitals above a block. */
export const CAPTION = 'm-0 text-xs font-semibold uppercase tracking-[0.04em] text-muted';
export const LINK = 'font-medium text-brand hover:text-brand-hover';
