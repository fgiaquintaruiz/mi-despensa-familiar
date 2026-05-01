import '@testing-library/jest-dom';

// next/navigation redirect() throws internally to stop Server Component render.
// Mocks must replicate this — a plain vi.fn() will let code run past the redirect and crash.
// Pattern:
//   vi.mock('next/navigation', () => ({
//     redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
//   }));
//   await expect(Component(props)).rejects.toThrow('NEXT_REDIRECT:/target');
