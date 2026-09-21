import "@testing-library/jest-dom/vitest";

// jsdom 未实现以下浏览器 API，而 motion / Radix UI 依赖它们。
// 这里提供最小可用的桩实现，避免测试环境报错（不影响生产代码）。
class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (!("IntersectionObserver" in globalThis)) {
  (globalThis as any).IntersectionObserver = MockObserver;
}
if (!("ResizeObserver" in globalThis)) {
  (globalThis as any).ResizeObserver = MockObserver;
}

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as any;
}

// Radix UI 的部分组件会调用这些指针/滚动 API
if (!(Element.prototype as any).scrollIntoView) {
  (Element.prototype as any).scrollIntoView = () => {};
}
if (!(Element.prototype as any).hasPointerCapture) {
  (Element.prototype as any).hasPointerCapture = () => false;
}
if (!(Element.prototype as any).setPointerCapture) {
  (Element.prototype as any).setPointerCapture = () => {};
}
if (!(Element.prototype as any).releasePointerCapture) {
  (Element.prototype as any).releasePointerCapture = () => {};
}
