'use client';

import { useEffect } from 'react';
import type { LiveValue } from './hooks';

/** What every demo takes: where to send the values the hook would give. */
export interface DemoProps {
  onValues: (values: LiveValue[]) => void;
}

/** Sends the values each time one of them changes. */
export function useEmit(onValues: DemoProps['onValues'], values: LiveValue[]) {
  const key = JSON.stringify(values);
  useEffect(() => onValues(values), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Shorthands for the values on the dark panel. */
export const live = {
  str: (key: string, value: string): LiveValue => ({ key, value, kind: 'string' }),
  num: (key: string, value: number | string): LiveValue => ({ key, value: String(value), kind: 'number' }),
  bool: (key: string, value: boolean | string): LiveValue => ({ key, value: String(value), kind: 'boolean' }),
  call: (key: string, value: string): LiveValue => ({ key, value, kind: 'call' }),
  empty: (key: string, value = 'undefined'): LiveValue => ({ key, value, kind: 'empty' }),
  error: (key: string, value: string): LiveValue => ({ key, value, kind: 'error' }),
  /** What the demo did, rather than what the hook gives. */
  demo: (value: LiveValue): LiveValue => ({ ...value, demo: true }),
};

export const primary = 'h-9 cursor-pointer rounded-lg border-0 bg-brand px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover';
export const secondary = 'h-9 cursor-pointer rounded-lg border border-border-strong bg-white px-3 text-sm text-ink transition-colors hover:bg-hover';
export const small = 'h-[30px] cursor-pointer rounded-[7px] border border-border-strong bg-white px-2.5 text-[13px] text-ink transition-colors hover:bg-hover';
export const field = 'min-w-0 rounded-[7px] border border-border bg-white px-2.5 py-1.75 text-sm text-ink';
/** A choice among several, or a switch: dark when on. */
export const choice = (on: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.75 text-[13px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;
export const hint = 'm-0 text-sm leading-normal text-muted';
/** Text selected in a demo. */
export const SELECTED = 'bg-[#cfe0fb]';
export const ERROR = 'text-delete';
