import { useRef, useEffect, useCallback, type ReactNode } from 'react';
import './FilterPopover.css';

interface FilterPopoverProps {
  trigger: ReactNode;
  content: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  align?: 'left' | 'right';
  width?: number;
}

export function FilterPopover({ trigger, content, isOpen, onClose, align = 'left', width }: FilterPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClickOutside, handleEscape]);

  return (
    <div className="filter-popover" ref={ref}>
      {trigger}
      {isOpen && (
        <div
          className={`filter-popover-dropdown filter-popover-dropdown--${align}`}
          style={width ? { width: `${width}px` } : undefined}
        >
          {content}
        </div>
      )}
    </div>
  );
}
