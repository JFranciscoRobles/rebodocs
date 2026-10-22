'use client';

import { type KeyboardEvent, useEffect, useLayoutEffect, useRef } from 'react';

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * The arrows, Home and End in a group of radios or tabs: put on the group, it
 * moves the focus to another and chooses it. Each item has `tabIndex` 0 when
 * it is the one chosen and -1 otherwise.
 */
export function roving(event: KeyboardEvent<HTMLElement>, choose: (index: number) => void) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role=radio],[role=tab]')];
  const from = items.indexOf(document.activeElement as HTMLElement);
  if (from < 0) return;
  let to: number;
  if (event.key === 'Home') to = 0;
  else if (event.key === 'End') to = items.length - 1;
  else if (STEP[event.key]) to = (from + STEP[event.key] + items.length) % items.length;
  else return;
  event.preventDefault();
  items[to].focus();
  choose(to);
}

/** Calls `handle` with the hash of the address now and each time it changes: how ⌘K and shared links open a hook or a prop. */
export function useHash(handle: (hash: string) => void) {
  useEffect(() => {
    const read = () => handle(decodeURIComponent(window.location.hash.slice(1)));
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * For a panel that is not shown but whose text is still to be found: give
 * what it returns to the panel as `ref`, with `hidden={!on}`. React writes
 * `hidden` alone, so on the server the panel is plainly hidden; in the browser
 * it becomes `hidden="until-found"`, which the browser's find looks into, and
 * finding something in it calls `onFound`.
 */
export function useUntilFound(on: boolean, onFound: () => void) {
  const box = useRef<HTMLDivElement>(null);
  const found = useRef(onFound);
  found.current = onFound;

  useLayoutEffect(() => {
    if (!on) box.current?.setAttribute('hidden', 'until-found');
  }, [on]);
  useEffect(() => {
    const element = box.current;
    const open = () => found.current();
    element?.addEventListener('beforematch', open);
    return () => element?.removeEventListener('beforematch', open);
  }, []);
  return box;
}
