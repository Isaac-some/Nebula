"use client";
import { useRef, useEffect, type ReactNode } from "react";
export default function Modal({
  children,
  onClose,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
