'use client';

import { useEffect, useState } from 'react';

/** The sections of the page, the one being read in blue. Hidden on a narrow screen. */
export function OnThisPage({ headings }: { headings: { id: string; text: string }[] }) {
  const [here, setHere] = useState(headings[0]?.id);

  useEffect(() => {
    const sections = headings.map((heading) => document.getElementById(heading.id)).filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;
    // The section being read is the last whose top has gone above a line a little under the bar.
    const pick = () => {
      let current = sections[0].id;
      for (const section of sections) if (section.getBoundingClientRect().top < 140) current = section.id;
      setHere(current);
    };
    const observer = new IntersectionObserver(pick, { rootMargin: '-120px 0px -60% 0px' });
    sections.forEach((section) => observer.observe(section));
    pick();
    return () => observer.disconnect();
  }, [headings]);

  return (
    <aside aria-label="On this page" className="hidden w-[200px] flex-none py-10 min-[1200px]:block">
      <div className="sticky top-[90px]">
        <p className="m-0 mb-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">On this page</p>
        {headings.length > 1 && (
          <ul className="m-0 list-none p-0">
            {headings.map((heading) => {
              const on = heading.id === here;
              return (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    aria-current={on ? 'location' : undefined}
                    className={`block border-l-2 py-1 pl-3 text-[13px] transition-colors ${on ? 'border-brand text-brand' : 'border-border text-muted hover:border-faint hover:text-ink'}`}
                  >
                    {heading.text}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        <p className="m-0 mt-5.5 font-hand text-[22px] leading-[1.1] text-pastel-pink-fg">tip: press ⌘K to jump to any prop</p>
      </div>
    </aside>
  );
}
