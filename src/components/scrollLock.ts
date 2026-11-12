let activeLocks = 0;
let originalOverflow = '';

export function lockBodyScroll() {
  const body = document.body;
  if (activeLocks === 0) {
    originalOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
  }
  activeLocks += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeLocks -= 1;
    if (activeLocks === 0) body.style.overflow = originalOverflow;
  };
}
