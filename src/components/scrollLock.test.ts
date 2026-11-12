import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {lockBodyScroll} from './scrollLock';

describe('modal body scroll lock', () => {
  let body: {style: {overflow: string}};

  beforeEach(() => {
    body = {style: {overflow: ''}};
    vi.stubGlobal('document', {body});
  });

  afterEach(() => vi.unstubAllGlobals());

  it('restores scrolling after the tour exits before its replacement dialog', () => {
    const closeTour = lockBodyScroll();
    const closeRelease = lockBodyScroll();
    closeTour();
    expect(body.style.overflow).toBe('hidden');
    closeRelease();
    expect(body.style.overflow).toBe('');
  });

  it('keeps the page locked when a nested dialog closes first', () => {
    body.style.overflow = 'auto';
    const closeParent = lockBodyScroll();
    const closeChild = lockBodyScroll();
    closeChild();
    expect(body.style.overflow).toBe('hidden');
    closeParent();
    expect(body.style.overflow).toBe('auto');
  });

  it('supports StrictMode setup and cleanup followed by reopening', () => {
    const firstCleanup = lockBodyScroll();
    firstCleanup();
    const closeDialog = lockBodyScroll();
    firstCleanup();
    expect(body.style.overflow).toBe('hidden');
    closeDialog();
    expect(body.style.overflow).toBe('');
  });
});
