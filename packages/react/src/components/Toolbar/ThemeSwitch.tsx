import React, { useContext } from "react";
import { locale, ThemeSetting } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import Combo from "./Combo";
import Select, { Option } from "./Select";
import SVGIcon from "../SVGIcon";

const ICONS: Record<ThemeSetting, string> = {
  light: "fortune-theme-light",
  dark: "fortune-theme-dark",
  auto: "fortune-theme-auto",
};

const ThemeIcons: React.FC = () => (
  <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
    <defs>
      <symbol id={ICONS.light} viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="3.75"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.99 5.99l1.41 1.41M16.6 16.6l1.41 1.41M5.99 18.01l1.41-1.41M16.6 7.4l1.41-1.41"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </symbol>
      <symbol id={ICONS.dark} viewBox="0 0 24 24" fill="none">
        <path
          d="M19.25 14.1A7.5 7.5 0 0 1 9.9 4.75a7.5 7.5 0 1 0 9.35 9.35Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id={ICONS.auto} viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="7.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M12 4.75a7.25 7.25 0 0 1 0 14.5Z" fill="currentColor" />
      </symbol>
    </defs>
  </svg>
);

/**
 * Toolbar item "theme": View › Light / Dark / System (follows the OS). The
 * button shows the theme in effect; the menu checks the chosen setting.
 */
const ThemeSwitch: React.FC = () => {
  const { context, settings, setTheme } = useContext(WorkbookContext);
  const { toolbar } = locale(context);
  const current: ThemeSetting = settings.theme ?? "light";
  const items: { value: ThemeSetting; text: string }[] = [
    { value: "light", text: toolbar.themeLight },
    { value: "dark", text: toolbar.themeDark },
    { value: "auto", text: toolbar.themeAuto },
  ];
  const currentText = items.find((i) => i.value === current)?.text;

  return (
    <>
      <ThemeIcons />
      <Combo
        iconId={ICONS[current] ?? ICONS.light}
        tooltip={toolbar.theme}
        text={currentText}
      >
        {(setOpen) => (
          <Select>
            {items.map(({ value, text }) => (
              <Option
                key={value}
                checked={value === current}
                onClick={() => {
                  setOpen(false);
                  setTheme?.(value);
                }}
              >
                <div
                  className="fortune-toolbar-menu-line fortune-theme-option"
                  data-theme-option={value}
                >
                  <SVGIcon name={ICONS[value]} width={18} height={18} />
                  <span className="fortune-theme-option-text">{text}</span>
                  <span className="fortune-theme-check" aria-hidden="true">
                    {value === current ? "✓" : ""}
                  </span>
                </div>
              </Option>
            ))}
          </Select>
        )}
      </Combo>
    </>
  );
};

export default ThemeSwitch;
