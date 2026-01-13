import type {
  AxiosInstance,
  AxiosStatic,
  InternalAxiosRequestConfig,
} from "axios";
import type { CookieJar } from "tough-cookie";

// Use CommonJS require to avoid ESM-only dependencies.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HttpCookieAgent, HttpsCookieAgent } = require("http-cookie-agent/http");

const AGENT_CREATED_BY_AXIOS_COOKIEJAR_SUPPORT = Symbol(
  "AGENT_CREATED_BY_AXIOS_COOKIEJAR_SUPPORT",
);
const WRAPPED_SYMBOL = Symbol("ACTIONHERO_AXIOS_COOKIEJAR_WRAPPED");

type AxiosWithJar = AxiosInstance & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create?: (...args: any[]) => AxiosInstance;
};

type ConfigWithJar = InternalAxiosRequestConfig & { jar?: CookieJar };

// Add cookie jar handling to axios in a CommonJS-friendly way.
function requestInterceptor(config: ConfigWithJar): ConfigWithJar {
  const jar = config.jar;

  if (!jar) return config;

  const agentHasFlag = (agent: unknown) =>
    Boolean(
      agent &&
      (agent as Record<PropertyKey, unknown>)[
        AGENT_CREATED_BY_AXIOS_COOKIEJAR_SUPPORT
      ] === true,
    );

  if (
    (config.httpAgent && !agentHasFlag(config.httpAgent)) ||
    (config.httpsAgent && !agentHasFlag(config.httpsAgent))
  ) {
    throw new Error(
      "axios-cookiejar-support does not support for use with other http(s).Agent.",
    );
  }

  config.httpAgent = new HttpCookieAgent({ cookies: { jar } });
  Object.defineProperty(
    config.httpAgent,
    AGENT_CREATED_BY_AXIOS_COOKIEJAR_SUPPORT,
    {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    },
  );

  config.httpsAgent = new HttpsCookieAgent({ cookies: { jar } });
  Object.defineProperty(
    config.httpsAgent,
    AGENT_CREATED_BY_AXIOS_COOKIEJAR_SUPPORT,
    {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    },
  );

  return config;
}

export function wrapper<T extends AxiosWithJar | AxiosStatic>(axios: T): T {
  if ((axios as unknown as Record<PropertyKey, unknown>)[WRAPPED_SYMBOL])
    return axios;

  axios.interceptors.request.use(requestInterceptor);

  if ("create" in axios && typeof axios.create === "function") {
    const create = axios.create.bind(axios);
    axios.create = (...args: unknown[]) => {
      const instance = create(...args);
      instance.interceptors.request.use(requestInterceptor);
      Object.defineProperty(instance, WRAPPED_SYMBOL, {
        configurable: false,
        enumerable: false,
        value: true,
        writable: false,
      });
      return instance as AxiosInstance;
    };
  }

  Object.defineProperty(axios, WRAPPED_SYMBOL, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return axios;
}

export default wrapper;
