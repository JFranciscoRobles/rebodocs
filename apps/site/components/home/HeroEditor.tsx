// The editor drawn in the hero: a picture of a document being worked on, made
// of CSS alone, laid out as DocsEditor comes: two rows of tools, the page on
// its canvas, the panel on the right and the zoom floating. It brings up the
// bar beside the selection, rolls the template variable through three clients
// and lets two notes float in.

const CLIENTS = ['{{client}}', 'Northwind S.A.', 'Studio Lumen', 'Casa Rivera', '{{client}}'];

/** The bar beside the selection, as the editor shows it over selected text: its words, in English. */
const BAR: { label: string; css?: string; delay?: string }[] = [
  { label: 'B', css: 'font-bold' },
  { label: 'I', css: 'italic' },
  { label: 'U', css: 'underline' },
  { label: 'S', css: 'line-through' },
  { label: 'Highlight', delay: '2.4s' },
  { label: '{{ }} Variable', delay: '3.4s' },
  { label: 'Note', delay: '4.4s' },
  { label: 'Link' },
];

/** The second row of tools; the ones further right give way first on a narrow screen. */
const TOOLS: { label: string; css?: string; from?: string }[] = [
  { label: 'Title ▾', from: 'sm' },
  { label: 'Arial ▾' },
  { label: '17 ▾' },
  { label: 'B', css: 'font-bold' },
  { label: 'I', css: 'italic font-serif' },
  { label: 'U', css: 'underline' },
  { label: 'S', css: 'line-through', from: 'sm' },
  { label: '≡ ▾', from: 'sm' },
  { label: '+ Insert ▾', from: 'md' },
  { label: 'Review ▾', from: 'md' },
];
const SHOWN_FROM: Record<string, string> = { sm: 'hidden sm:flex', md: 'hidden md:flex' };

const Avatar = ({ letter, tint, className = '' }: { letter: string; tint: string; className?: string }) => (
  <span className={`inline-flex size-6 items-center justify-center rounded-full border-2 border-[#fbfaf8] text-[11px] font-bold ${tint} ${className}`}>{letter}</span>
);

/** The value the variable takes, rolling in step with the one on the page. */
const Rolling = ({ className }: { className: string }) => (
  <span className={`inline-flex h-[1.5em] overflow-hidden rounded-md bg-pastel-yellow px-1.5 font-code ${className}`}>
    <span className="flex animate-roll flex-col">
      {CLIENTS.map((client, i) => (
        <span key={i} className="h-[1.5em] whitespace-nowrap font-medium leading-[1.5em] text-pastel-yellow-fg">
          {client}
        </span>
      ))}
    </span>
  </span>
);

const island = 'rounded-[14px] border border-[#e6e3dc] bg-[#fbfaf8]';
const tool = 'h-7 items-center rounded-lg px-2 text-[13px] text-[#2f2e2b]';

export function HeroEditor() {
  return (
    <div className="relative mx-auto mt-16 max-w-[980px] text-left" aria-hidden="true">
      <div className="flex flex-col gap-2 overflow-hidden rounded-[22px] border border-border bg-[#efede8] p-2 shadow-editor sm:gap-2.5 sm:p-2.5">
        {/* The tools, as an island: the document above, the format below. */}
        <div className={`${island} overflow-hidden`}>
          <div className="flex items-center gap-1 border-b border-[#e6e3dc] px-2 py-1.5 text-[13px] text-[#5f5d58]">
            <span className={`flex ${tool} text-[15px]`}>☰</span>
            <span className="mx-1 h-4 w-px bg-[#e6e3dc]" />
            <span className="font-semibold text-[#2f2e2b]">receipt.docx</span>
            <span className={`hidden sm:flex ${tool} text-[#5f5d58]`}>↶ ↷</span>
            <span className="ml-auto flex items-center pr-1">
              <Avatar letter="C" tint="bg-pastel-blue text-pastel-blue-fg" />
              <Avatar letter="A" tint="bg-pastel-pink text-pastel-pink-fg" className="-ml-2" />
            </span>
          </div>
          <div className="flex items-center gap-0.5 px-2 py-1.5">
            {TOOLS.map((item, i) => (
              <span key={item.label} className={`${item.from ? SHOWN_FROM[item.from] : 'flex'} items-center`}>
                {i === 3 || i === 7 || i === 8 ? <i className="mx-1 h-4 w-px bg-[#e6e3dc]" /> : null}
                <span className={`flex whitespace-nowrap ${tool} ${item.css ?? ''}`}>{item.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 sm:gap-2.5">
          {/* The page, on its canvas, with the zoom floating over it. */}
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-[14px] px-[clamp(8px,3vw,32px)] pt-[clamp(10px,2.4vw,24px)]">
            <div className="mx-auto max-w-[600px] rounded-[3px] bg-white px-[clamp(20px,5vw,60px)] pb-24 pt-10 text-[16px] leading-[1.7] shadow-[0_1px_3px_rgba(47,46,43,0.12),0_8px_24px_-12px_rgba(47,46,43,0.18)]">
              <svg width="40" height="40" viewBox="0 0 44 44">
                <rect width="44" height="44" rx="10" fill="#FBF3DB" />
                <path d="M14 12h11l5 5v15H14z" fill="none" stroke="#B07A00" strokeWidth="2" strokeLinejoin="round" />
                <path d="M18 22h8M18 26h6" stroke="#B07A00" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="mt-3 font-display text-[30px] font-extrabold tracking-[-0.03em]">Receipt</div>
              <div className="mt-2 text-ink-soft">
                Billed to <Rolling className="align-[-0.38em] text-[14px]" /> — payment due in <span className="text-delete line-through">30</span>{' '}
                <span className="rounded bg-pastel-blue px-[3px] text-brand">15</span> days.
              </div>
              <div className="relative mt-[70px] text-ink-soft">
                {/* The bar beside the selection comes up over what is selected. */}
                <div className="absolute -top-[54px] left-0 z-[2] flex origin-bottom-left animate-menu-in items-center gap-0.5 rounded-xl border border-border bg-white p-1 text-sm opacity-0 shadow-menu">
                  {BAR.map((item, i) => (
                    <span key={item.label} className={`${i > 5 ? 'hidden sm:flex' : 'flex'} items-center`}>
                      {i === 4 || i === 5 ? <i className="mx-1 h-5 w-px bg-border" /> : null}
                      <span
                        className={`animate-menu-hover whitespace-nowrap rounded-md px-2 py-1 text-ink ${item.css ?? ''}`}
                        style={item.delay ? { animationDelay: item.delay } : { animation: 'none' }}
                      >
                        {item.label}
                      </span>
                    </span>
                  ))}
                </div>
                The <span className="rounded-sm bg-[#cfe0fb] text-ink">total amount</span> is paid on the day of the reservation
                <span className="ml-px inline-block h-[1.1em] w-0.5 animate-blink bg-brand align-[-0.2em]" />
              </div>
            </div>
            <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 text-[12px] text-[#5f5d58]">
              <span className="rounded-full border border-[#e6e3dc] bg-white px-3 py-1.5 shadow-[0_2px_8px_rgba(47,46,43,0.08)]">
                Page 1 of 1<span className="hidden sm:inline"> · 42 words</span>
              </span>
              <span className="flex items-center gap-2 rounded-full border border-[#e6e3dc] bg-white px-3 py-1.5 shadow-[0_2px_8px_rgba(47,46,43,0.08)]">
                −
                <i className="relative hidden h-1 w-16 rounded-full bg-[#e6e3dc] sm:block">
                  <i className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-[#0b57d0]" />
                </i>
                +<span>100 %</span>
              </span>
            </div>
          </div>

          {/* The panel on the right: the variables of the template. */}
          <div className="hidden w-[230px] shrink-0 flex-col gap-3 rounded-[14px] border border-[#e6e3dc] bg-white p-3 text-[13px] md:flex">
            <div className="flex rounded-lg bg-[#f3f1ec] p-0.5 text-[12px] font-semibold text-[#5f5d58]">
              <span className="flex-1 rounded-md bg-white py-1 text-center text-[#2f2e2b] shadow-[0_1px_2px_rgba(47,46,43,0.12)]">Variables</span>
              <span className="flex-1 py-1 text-center">Notes</span>
              <span className="flex-1 py-1 text-center">Changes</span>
            </div>
            {[
              ['client', <Rolling key="r" className="text-[12px]" />],
              [
                'amount',
                <span key="a" className="text-[#2f2e2b]">
                  $2,500.00
                </span>,
              ],
            ].map(([name, value]) => (
              <div key={name as string} className="rounded-[10px] border border-[#e6e3dc] px-2.5 py-2">
                <div className="font-code text-[11px] text-[#5f5d58]">{name}</div>
                <div className="mt-1">{value}</div>
              </div>
            ))}
            <div className="mt-auto rounded-lg bg-[#e8f0fd] px-2.5 py-2 text-center text-[12px] font-semibold text-[#0b57d0]">Fill 2 variables in the document</div>
          </div>
        </div>
      </div>

      {/* Two notes beside it; on a phone they would cover the text. */}
      <div className="absolute -right-6 bottom-[78px] z-10 hidden w-[220px] animate-[pop-in_0.5s_cubic-bezier(0.2,0.8,0.2,1)_3s_forwards,float_6s_ease-in-out_3.5s_infinite] rounded-[14px] border border-border bg-white px-3.5 py-3 text-[13px] leading-[1.45] opacity-0 shadow-[0_14px_30px_rgba(47,46,43,0.12)] md:block">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-pastel-blue text-[11px] font-bold text-pastel-blue-fg">C</span>
          <span className="font-semibold">Claude</span>
          <span className="text-muted">· via MCP</span>
        </div>
        <div className="mt-1.5 text-ink-soft">Suggested 30 → 15 days, per the new terms.</div>
      </div>
      <div className="absolute -left-[30px] bottom-[84px] z-10 hidden animate-[pop-in_0.5s_cubic-bezier(0.2,0.8,0.2,1)_3.6s_forwards,float_8s_ease-in-out_4.1s_infinite] rounded-[14px] bg-pastel-pink px-4 py-2.5 opacity-0 md:block">
        <span className="font-hand text-2xl font-semibold text-pastel-pink-fg">Ana is editing…</span>
      </div>
    </div>
  );
}
