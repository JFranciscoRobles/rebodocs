'use client';

import { useDocsOutline } from '@rebodocs/react';

function Outline() {
  const { items, active, goTo } = useDocsOutline();
  return (
    <nav className="grid">
      {items.map((item, i) => (
        <button
          key={item.para}
          aria-current={i === active}
          className="truncate rounded px-1.5 py-1 text-left text-sm aria-[current=true]:bg-blue-100 aria-[current=true]:font-semibold"
          style={{ paddingLeft: 6 + item.level * 12 }}
          onClick={() => goTo(item)}
        >
          {item.text}
        </button>
      ))}
    </nav>
  );
}

// ---- On this page ----

export default function Example() {
  return <Outline />;
}
