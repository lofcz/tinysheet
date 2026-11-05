const { TestEnvironment } = require("jest-environment-jsdom");
const { TextEncoder, TextDecoder } = require("node:util");

// jsdom omits these browser APIs; use the host implementations for workbook IO.
module.exports = class WorkbookTestEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    Object.assign(this.global, { TextEncoder, TextDecoder, structuredClone });
  }
};
