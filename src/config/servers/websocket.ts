// Note that to use the websocket server, you also need the `web` server enabled

export const DEFAULT = {
  servers: {
    websocket: () => {
      return {
        enabled: true,
      };
    },
  },
};
