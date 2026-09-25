import React, { useContext, useMemo } from "react";
import { ModalContext } from "../../context/modal";
import PageSetupDialog, { PageSetupTab } from "./PageSetupDialog";
import PrintPreview from "./PrintPreview";

export type PageLayoutDialogs = {
  openPrintPreview: () => void;
  openPageSetup: (tab?: PageSetupTab, backToPreview?: boolean) => void;
  hideModal: () => void;
};

/** Opens the Page Setup dialog and the Print Preview (they link to each other). */
export function usePageLayoutDialogs(): PageLayoutDialogs {
  const { showModal, hideModal } = useContext(ModalContext);
  return useMemo(() => {
    const api: PageLayoutDialogs = {
      hideModal,
      openPrintPreview: () =>
        showModal(
          <PrintPreview
            onClose={hideModal}
            onPageSetup={() => api.openPageSetup("page", true)}
          />
        ),
      openPageSetup: (tab = "page", backToPreview = false) =>
        showModal(
          <PageSetupDialog
            initialTab={tab}
            onClose={backToPreview ? api.openPrintPreview : hideModal}
            onPrintPreview={api.openPrintPreview}
          />
        ),
    };
    return api;
  }, [showModal, hideModal]);
}
