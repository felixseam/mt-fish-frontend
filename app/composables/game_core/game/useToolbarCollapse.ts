export function collapseToolbarNow() {
  if (typeof window === "undefined") return;
  window.scrollTo(0, 1);
}