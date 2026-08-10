import { useCallback, useEffect, useRef, useState } from 'react';

export type DownloadState = 'idle' | 'preparing' | 'downloading' | 'completed' | 'error';

interface UseFileDownloadOptions {
  fileUrl?: string;
  fileName?: string;
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onDownloadError?: (error: unknown) => void;
}

interface UseFileDownloadResult {
  downloadState: DownloadState;
  progress: number;
  statusMessage: string;
  download: () => Promise<void>;
  reset: () => void;
  isBusy: boolean;
  canRetry: boolean;
}

function deriveFileName(url: string, fallback?: string) {
  const parsed = new URL(url, window.location.origin);
  const fromPath = parsed.pathname.split('/').filter(Boolean).pop();
  return fallback || fromPath || 'download';
}

export function useFileDownload({
  fileUrl,
  fileName,
  onDownloadStart,
  onDownloadComplete,
  onDownloadError,
}: UseFileDownloadOptions): UseFileDownloadResult {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready to download');
  const [, setIsIndeterminate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stateRef = useRef<DownloadState>('idle');
  const indeterminateTimerRef = useRef<number | null>(null);
  const lastAnnouncedPercentRef = useRef<number | null>(null);

  const clearIndeterminateTimer = useCallback(() => {
    if (indeterminateTimerRef.current !== null) {
      window.clearInterval(indeterminateTimerRef.current);
      indeterminateTimerRef.current = null;
    }
  }, []);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const announceProgress = useCallback((value: number) => {
    const rounded = Math.round(value / 10) * 10;
    if (rounded < 10) {
      return;
    }
    if (lastAnnouncedPercentRef.current === rounded) {
      return;
    }
    lastAnnouncedPercentRef.current = rounded;
    setStatusMessage(`Download ${rounded} percent complete`);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearIndeterminateTimer();
    revokeObjectUrl();
    stateRef.current = 'idle';
    setDownloadState('idle');
    setProgress(0);
    setIsIndeterminate(false);
    setStatusMessage('Ready to download');
    lastAnnouncedPercentRef.current = null;
  }, [clearIndeterminateTimer, revokeObjectUrl]);

  const download = useCallback(async () => {
    if (!fileUrl) {
      setDownloadState('error');
      setStatusMessage('Download failed');
      onDownloadError?.(new Error('No file URL supplied'));
      return;
    }

    if (stateRef.current === 'preparing' || stateRef.current === 'downloading') {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    clearIndeterminateTimer();
    revokeObjectUrl();
    stateRef.current = 'preparing';
    setDownloadState('preparing');
    setProgress(0);
    setIsIndeterminate(false);
    setStatusMessage('Preparing download');
    lastAnnouncedPercentRef.current = null;
    onDownloadStart?.();

    try {
      const response = await fetch(fileUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null;
      const hasKnownLength = typeof contentLength === 'number' && Number.isFinite(contentLength) && contentLength > 0;

      stateRef.current = 'downloading';
      setDownloadState('downloading');
      setStatusMessage('Download in progress');
      setIsIndeterminate(!hasKnownLength);

      if (!hasKnownLength) {
        indeterminateTimerRef.current = window.setInterval(() => {
          setProgress((current) => {
            const next = Math.min(90, current + 8);
            if (next >= 10) {
              announceProgress(next);
            }
            return next;
          });
        }, 180);
      }

      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            chunks.push(value);
            receivedBytes += value.byteLength;
            if (hasKnownLength && contentLength) {
              const nextProgress = Math.min(100, Math.round((receivedBytes / contentLength) * 100));
              setProgress(nextProgress);
              if (nextProgress >= 10) {
                announceProgress(nextProgress);
              }
            }
          }
        }
      }

      const blob = response.body
        ? new Blob(chunks as unknown as BlobPart[], { type: response.headers.get('content-type') ?? 'application/octet-stream' })
        : await response.blob();

      const downloadName = fileName || deriveFileName(fileUrl, fileName);
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = downloadName;
      anchor.click();
      revokeObjectUrl();

      clearIndeterminateTimer();
      setProgress(100);
      setIsIndeterminate(false);
      setStatusMessage('Download completed');
      setDownloadState('completed');
      stateRef.current = 'completed';
      onDownloadComplete?.();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      clearIndeterminateTimer();
      stateRef.current = 'error';
      setDownloadState('error');
      setProgress(0);
      setIsIndeterminate(false);
      setStatusMessage('Download failed');
      onDownloadError?.(error);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [announceProgress, clearIndeterminateTimer, fileName, fileUrl, onDownloadComplete, onDownloadError, onDownloadStart, revokeObjectUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearIndeterminateTimer();
      revokeObjectUrl();
    };
  }, [clearIndeterminateTimer, revokeObjectUrl]);

  return {
    downloadState,
    progress,
    statusMessage,
    download,
    reset,
    isBusy: downloadState === 'preparing' || downloadState === 'downloading',
    canRetry: downloadState === 'error',
  };
}
