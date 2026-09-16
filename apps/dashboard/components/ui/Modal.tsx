'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { spring } from '../motion';

/**
 * A dialog that springs up over a blurred scrim. Escape and a scrim click both
 * close it, and the page behind is locked so the modal's own scroll area is
 * the only thing that moves.
 */
export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="modal-root">
          <motion.div
            className="modal-scrim"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(7px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14, transition: { duration: 0.16 } }}
            transition={spring}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
