import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
afterEach(cleanup);
window.matchMedia = vi.fn().mockImplementation(query => ({ matches: query.includes('min-width'), media: query, addEventListener() {}, removeEventListener() {} }));
class Observer { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', Observer);
