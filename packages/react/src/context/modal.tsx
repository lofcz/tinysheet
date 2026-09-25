import React, {
  useCallback,
  useState,
  useMemo,
  useContext,
  useEffect,
  useRef,
} from "react";
import WorkbookContext from ".";
import { TrackedScope } from "./store";
import {
  DIALOG_CLOSE_SELECTOR,
  focusFirstIn,
  useDialogBehavior,
} from "../hooks/useDialogBehavior";

const ModalContext = React.createContext<{
  component: React.ReactNode;
  showModal: (c: React.ReactNode) => void;
  hideModal: () => void;
}>({
  component: null,
  showModal: () => {},
  hideModal: () => {},
});

/**
 * The backdrop of one modal dialog: keeps the keyboard in the dialog
 * (focus on open, Tab cycling, focus back on close), closes it on Escape
 * (through its close button, so the dialog's own cancel logic runs) and
 * lets its title bar drag it.
 */
const ModalFrame: React.FC<{
  theme: string;
  hideModal: () => void;
  children?: React.ReactNode;
}> = ({ theme, hideModal, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { refs } = useContext(WorkbookContext);
  useDialogBehavior(ref, {
    modal: true,
    fallbackFocus: () =>
      refs?.cellInput?.current?.focus({ preventScroll: true }),
    onEscape: () => {
      const close = ref.current?.querySelector<HTMLElement>(
        DIALOG_CLOSE_SELECTOR
      );
      if (close) close.click();
      else hideModal();
    },
    getDragTarget: () =>
      (ref.current?.firstElementChild as HTMLElement | null) ?? null,
  });
  // another dialog replaced this one: its first control gets the focus
  useEffect(() => {
    const root = ref.current;
    if (root && !root.contains(document.activeElement)) focusFirstIn(root);
  }, [children]);
  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className="fortune-popover-backdrop fortune-modal-container"
      data-theme={theme}
    >
      <TrackedScope>{children}</TrackedScope>
    </div>
  );
};

const ModalProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [component, setComponent] = useState<React.ReactNode>(null);
  // Modals render outside .fortune-container, so they carry the theme too.
  const { context } = useContext(WorkbookContext);

  const showModal = useCallback((c: React.ReactNode) => {
    setComponent(c);
  }, []);

  const hideModal = useCallback(() => {
    setComponent(null);
  }, []);

  const providerValue = useMemo(
    () => ({
      component: null,
      showModal,
      hideModal,
    }),
    [hideModal, showModal]
  );

  return (
    <ModalContext.Provider value={providerValue}>
      {children}
      {component && (
        <ModalFrame theme={context.theme || "light"} hideModal={hideModal}>
          {component}
        </ModalFrame>
      )}
    </ModalContext.Provider>
  );
};

export { ModalContext, ModalProvider };
