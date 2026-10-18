// Format codes and font IDs are workbook metadata, not translated messages.
import type { LocaleSection } from "../i18n/runtime";
const formatTemplates = (currency: string) => [
  { value: "General", example: "" },
  { value: "@", example: "" },
  { value: "split", example: "" },
  { value: "##0.00", example: "1000.12" },
  { value: "#0.00%", example: "12.21%" },
  { value: "0.00E+00", example: "1.01E+5" },
  { value: "split", example: "" },
  {
    value: `${currency}(0.00)`,
    example: `${currency}(1200.09)`,
  },

  {
    value: `${currency}0.00`,
    example: `${currency}1200.09`,
  },

  { value: "split", example: "" },
  { value: "yyyy-MM-dd", example: "2017-11-29" },
  { value: "hh:mm AM/PM", example: "3:00 PM" },
  { value: "hh:mm", example: "15:00" },
  {
    value: "yyyy-MM-dd hh:mm AM/PM",
    example: "2017-11-29 3:00 PM",
  },
  {
    value: "yyyy-MM-dd hh:mm",
    example: "2017-11-29 15:00",
  },
  { value: "split", example: "" },
  {
    value: "fmtOtherSelf",
    example: "",
    icon: "rightArrow",
  },
];
export function gridMetadata(strings: LocaleSection<"grid">) {
  return {
    fontjson: { "times new roman": 0, arial: 1, tahoma: 2, verdana: 3 },
    defaultFmt: (currency: string) =>
      formatTemplates(currency).map((format, index) => ({
        ...format,
        text: strings.numberFormatLabels[index],
      })),
  };
}
