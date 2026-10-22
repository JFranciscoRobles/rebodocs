'use client';

import { useDocsVariables } from '@rebodocs/react';
import { useState } from 'react';

function Variables() {
  const variables = useDocsVariables();
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); variables.fill(values); }}>
      {variables.names.map((name) => {
        const money = variables.formats[name]?.some((format) => format.id === 'currency') ?? false;
        const { text, bad } = variables.preview(name, values[name] ?? '');
        return (
          <label key={name} className="grid gap-0.5 text-xs text-neutral-600">
            {name}
            <span className="flex gap-1">
              <input className="min-w-0 flex-1 rounded border border-neutral-300 px-1.5 py-0.5 text-sm text-black" value={values[name] ?? ''} onFocus={() => variables.select(name)} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />
              <button type="button" className="rounded border border-neutral-300 px-1.5 aria-pressed:bg-blue-100" aria-pressed={money} onClick={() => variables.setFormat(name, 'currency', !money)}>$</button>
            </span>
            <small className={bad ? 'text-red-700' : ''}>{bad ? 'Not what its format is for' : text}</small>
          </label>
        );
      })}
      <button className="rounded-md bg-blue-700 px-2.5 py-1 text-sm text-white">Fill</button>
    </form>
  );
}

// ---- On this page ----

export default function Example() {
  return <Variables />;
}
