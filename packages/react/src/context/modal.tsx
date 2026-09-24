import React, { useCallback, useState, useMemo, useContext } from "react";
import WorkbookContext from ".";

const ModalContext = React.createContext<{
  component: React.ReactNode;
  showModal: (c: React.ReactNode) => void;
  hideModal: () => void;
}>({
  component: null,
  showModal: () => {},
  hideModal: () => {},
});

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
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          className="fortune-popover-backdrop fortune-modal-container"
          data-theme={context.theme || "light"}
        >
          {component}
        </div>
      )}
    </ModalContext.Provider>
  );
};

export { ModalContext, ModalProvider };
