import { cache, Action, ParamsFrom } from "./../index";

export class CacheTest extends Action {
  name = "cacheTest";
  description = "I will test the internal cache functions of the API";
  inputs = {
    key: {
      required: true as true,
      formatter: this.stringFormatter,
      validator: this.stringValidator,
    },

    value: {
      required: true as true,
      formatter: this.stringFormatter,
      validator: this.stringValidator,
    },
  };

  outputExample = {
    cacheTestResults: {
      saveResp: true,
      sizeResp: 1,
      loadResp: {
        key: "cacheTest_key",
        value: "value",
        createdAt: 1420953269716,
      },
      deleteResp: true,
    },
  };

  stringFormatter(s: unknown) {
    return String(s);
  }

  stringValidator(s: string) {
    if (s.length < 3) {
      return "inputs should be at least 3 letters long";
    } else {
      return true;
    }
  }

  async run({ params }: { params: ParamsFrom<CacheTest> }) {
    const key = `cacheTest_${params.key}`;
    const value = params.value;

    return {
      cacheTestResults: {
        saveResp: await cache.save(key, value, 5000),
        sizeResp: await cache.size(),
        loadResp: await cache.load(key),
        deleteResp: await cache.destroy(key),
      },
    };
  }
}
