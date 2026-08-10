// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatedDownloadButton } from './AnimatedDownloadButton';

describe('AnimatedDownloadButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('completes a real download and shows the completed state', async () => {
    const clickSpy = vi.fn();
    const anchor = document.createElement('a');
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return anchor as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });
    vi.spyOn(anchor, 'click').mockImplementation(clickSpy);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('demo'));
        controller.close();
      },
    });

    const createObjectUrl = vi.fn().mockReturnValue('blob:demo');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revokeObjectUrl });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === 'content-length' ? '4' : null) },
      body: stream,
    }));

    render(<AnimatedDownloadButton fileUrl="/demo.txt" fileName="demo.txt" />);

    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => expect(screen.getByText(/downloaded!/i)).toBeInTheDocument());
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('shows an error state and allows retry after a failed download', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    render(<AnimatedDownloadButton fileUrl="/demo.txt" fileName="demo.txt" />);

    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText(/download failed/i)).toBeInTheDocument());
  });
});
