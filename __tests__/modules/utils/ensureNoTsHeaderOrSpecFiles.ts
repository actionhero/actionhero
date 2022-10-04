import { ensureNoTsHeaderOrSpecFiles } from "../../../src/modules/utils/ensureNoTsHeaderOrSpecFiles";

describe("ensureNoTsHeaderOrSpecFiles", () => {
  it("filters header files", () => {
    const filtered = ensureNoTsHeaderOrSpecFiles([
      "afdasf.d.ts",
      "some-file.ts",
    ]);
    expect(filtered).toEqual(["some-file.ts"]);
  });

  it("filters test/spec files", () => {
    const filtered = ensureNoTsHeaderOrSpecFiles([
      "afdasf.spec.ts",
      "afdasfsdfa.spec.js",
      "spec.js",
      "test-my-api.js",
      "afdasfsdfa.test.js",
      "afdasfsdfa.test.ts",
      "some-file.ts",
    ]);
    expect(filtered).toEqual(["spec.js", "test-my-api.js", "some-file.ts"]);
  });
});
