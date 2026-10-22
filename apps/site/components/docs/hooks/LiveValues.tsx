import type { LiveValue } from './hooks';

const COLOR: Record<LiveValue['kind'], string> = {
  string: 'text-[#f5c443]',
  number: 'text-[#9ee0b0]',
  boolean: 'text-[#f2a7c3]',
  call: 'text-[#c9b8f0]',
  empty: 'text-[#a8a49a]',
  error: 'text-[#f28b7d]',
};

function Row({ value }: { value: LiveValue }) {
  return (
    <div className="flex gap-2.5 whitespace-nowrap">
      <span className="text-[#9cc0fa]">{value.key}</span>
      <span className="text-[#a8a49a]" aria-hidden="true">
        →
      </span>
      <span className={COLOR[value.kind]}>{value.value}</span>
    </div>
  );
}

/**
 * What the hook gives right now, each value coloured by what it is; what the
 * demo did with it goes apart, under a comment, so it is not taken for the API.
 * Only what changes is read out.
 */
export function LiveValues({ values }: { values: LiveValue[] }) {
  const given = values.filter((value) => !value.demo);
  const done = values.filter((value) => value.demo);
  return (
    <div aria-live="polite" aria-atomic="false" className="mt-2.5 overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[13px] leading-[1.75] text-[#edece8]">
      {given.map((value) => (
        <Row key={value.key} value={value} />
      ))}
      {done.length > 0 && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <div className="whitespace-nowrap text-[#a8a49a]">{'// in this demo, not from the hook'}</div>
          {done.map((value) => (
            <Row key={value.key} value={value} />
          ))}
        </div>
      )}
      {!values.length && <span className="text-[#a8a49a]">…</span>}
    </div>
  );
}
