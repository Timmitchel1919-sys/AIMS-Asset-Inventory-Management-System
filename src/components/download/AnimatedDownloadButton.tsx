import { Check, Download, RotateCcw } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useFileDownload } from '../../hooks/useFileDownload';
import './AnimatedDownloadButton.css';

export interface AnimatedDownloadButtonProps extends ComponentPropsWithoutRef<'button'> {
  fileUrl?: string;
  fileName?: string;
  label?: string;
  completedLabel?: string;
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onDownloadError?: (error: unknown) => void;
}

export function AnimatedDownloadButton({
  fileUrl,
  fileName,
  label = 'Download',
  completedLabel = 'Downloaded!',
  disabled = false,
  className,
  onDownloadStart,
  onDownloadComplete,
  onDownloadError,
  ...buttonProps
}: AnimatedDownloadButtonProps) {
  const { downloadState, progress, statusMessage, download, isBusy, canRetry } = useFileDownload({
    fileUrl,
    fileName,
    onDownloadStart,
    onDownloadComplete,
    onDownloadError,
  });

  const isPreparing = downloadState === 'preparing';
  const isDownloading = downloadState === 'downloading';
  const isCompleted = downloadState === 'completed';
  const isError = downloadState === 'error';

  const buttonLabel = isCompleted ? completedLabel : isError ? 'Try again' : label;
  const buttonAriaLabel = `${buttonLabel}${isDownloading ? `, ${progress}% complete` : ''}`;

  return (
    <button
      type="button"
      className={["animated-download-button", className].filter(Boolean).join(" ")}
      onClick={() => {
        if (disabled || isBusy || isCompleted) {
          return;
        }
        void download();
      }}
      disabled={disabled || isBusy || isCompleted}
      aria-label={buttonAriaLabel}
      aria-busy={isPreparing || isDownloading}
      {...buttonProps}
    >
      <span className="animated-download-button__content">
        {isPreparing || isDownloading ? (
          <span
            className="animated-download-button__progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={`Download progress: ${progress}%`}
          >
            <span className="animated-download-button__track">
              <span className="animated-download-button__fill" style={{ width: `${progress}%` }} />
            </span>
          </span>
        ) : (
          <span className="animated-download-button__label">{buttonLabel}</span>
        )}

        <span
          className={[
            'animated-download-button__icon',
            isDownloading ? 'animated-download-button__icon--downloading' : '',
            isCompleted ? 'animated-download-button__icon--completed' : '',
            isError ? 'animated-download-button__icon--error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isCompleted ? <Check /> : isError ? <RotateCcw /> : <Download />}
        </span>
      </span>

      <span className="sr-only" aria-live="polite">
        {statusMessage}
      </span>
      {canRetry && <span className="sr-only">Try again</span>}
    </button>
  );
}

export default AnimatedDownloadButton;
