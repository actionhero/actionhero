describe("jest", () => {
  test("should automatically set NODE_ENV to test", () => {
    expect(process.env.NODE_ENV).toBe("test");
  });
});
