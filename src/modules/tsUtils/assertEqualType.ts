// from https://2ality.com/2019/07/testing-static-types.html

export type AssertEqualType<T, Expected> = T extends Expected
  ? Expected extends T
    ? true
    : FailingTypeMatchAssertion
  : FailingTypeMatchAssertion;

export type FailingTypeMatchAssertion = never;
