import React, { useContext } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { formulaAuditLocale } from "../../core/src/locale/formulaAudit";
import { dialogsLocale } from "@lofcz/tinysheet-core";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";
import WorkbookContext from "../src/context";
import { DialogShell } from "../src/components/ui/Dialog";
import { Combo, Select } from "../src/components/ui/Select";
import { LargeButton } from "../src/components/ui/Button";

describe("localized workbook UI", () => {
  test.each(["cs", "sk", "pl"])(
    "%s shows the circular-reference warning and status in the selected language",
    async (lang) => {
      const ref = React.createRef<WorkbookInstance>();
      const view = render(
        <Workbook ref={ref} lang={lang} data={[{ name: "Data" }]} />
      );
      act(() => ref.current!.setCellValue(0, 1, "=B2+1"));
      act(() => ref.current!.setCellValue(1, 1, "=B1+1"));
      const t = formulaAuditLocale({ lang }).calc;
      expect(await view.findByText(t.circularWarning)).toBeTruthy();
      expect(view.getByTestId("status-circular").textContent).toMatch(
        new RegExp(`^${t.circularReferences}: B[12]$`)
      );
      expect(
        view.queryByText(/There are one or more circular references/)
      ).toBeNull();
      fireEvent.click(view.getByRole("button", { name: "OK", exact: true }));
      await waitFor(() =>
        expect(view.queryByText(t.circularWarning)).toBeNull()
      );
    }
  );

  it("updates shared controls and accessible labels when the locale changes", () => {
    const close = jest.fn();
    const Controls = ({ lang }: { lang: string }) => {
      const value = useContext(WorkbookContext);
      return (
        <WorkbookContext.Provider
          value={{ ...value, context: { ...value.context, lang } }}
        >
          <DialogShell title="Dialog" onClose={close}>
            <Combo
              aria-label="Size"
              value="12"
              options={[]}
              onCommit={() => {}}
            />
            <LargeButton label="Action" onClick={() => {}} menu={[]} />
            <Select
              aria-label="Format"
              value="currency"
              options={[{ value: "currency", label: "Měna" }]}
              onChange={() => {}}
            />
          </DialogShell>
        </WorkbookContext.Provider>
      );
    };
    const view = render(<Controls lang="en" />);
    expect(view.getByRole("button", { name: "Size: open list" })).toBeTruthy();
    for (const lang of ["cs", "sk", "pl"]) {
      view.rerender(<Controls lang={lang} />);
      const t = dialogsLocale({ lang });
      expect(
        view.getByRole("button", {
          name: t.openList.replace("{label}", "Size"),
        })
      ).toBeTruthy();
      expect(
        view.getByRole("button", {
          name: t.moreOptions.replace("{label}", "Action"),
        })
      ).toBeTruthy();
      expect(view.getByRole("button", { name: "Format: Měna" })).toBeTruthy();
      expect(
        view.queryByRole("button", { name: "Close", exact: true })
      ).toBeNull();
      fireEvent.click(view.getByRole("button", { name: t.close, exact: true }));
    }
    expect(close).toHaveBeenCalledTimes(3);
  });
});
