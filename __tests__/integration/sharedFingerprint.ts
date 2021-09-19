/**
 * @jest-environment jsdom
 */

"use strict";
// we need to use 'use strict' here because we are loading a variable from a remote host

process.env.AUTOMATIC_ROUTES = "get";

import * as _Primus from "primus";
import * as request from "request-promise-native";
import { api, Process, config } from "./../../src/index";

const actionhero = new Process();
let ActionheroWebsocketClient: any;
let fingerprint: string;
let url: string;

const connectClient = async (query = ""): Promise<any> => {
  const S = _Primus.createSocket(undefined);
  const clientSocket = new S(`http://localhost:${config.web.port}?${query}`);

  let client = new ActionheroWebsocketClient({}, clientSocket); // eslint-disable-line
  const connectResponse = await new Promise((resolve, reject) => {
    client.connect((error: Error, connectResponse: Record<string, any>) => {
      if (error) {
        return reject(error);
      }
      resolve(connectResponse);
    });
  });

  return { client, connectResponse };
};

describe("Integration: Web Server + Websocket Socket shared fingerprint", () => {
  beforeAll(async () => {
    await actionhero.start();
    await api.redis.clients.client.flushdb();
    url = "http://localhost:" + config.web.port;
    ActionheroWebsocketClient = eval(
      // @ts-ignore
      api.servers.servers.websocket.compileActionheroWebsocketClientJS()
    ); // eslint-disable-line
  });

  afterAll(async () => await actionhero.stop());

  test("should exist when web server been called", async () => {
    const body = await request.get({
      uri: url + "/api/randomNumber",
      json: true,
    });
    fingerprint = body.requesterInformation.fingerprint;
    const query = `${config.web.fingerprintOptions.cookieKey}=${fingerprint}`;
    const { client, connectResponse } = await connectClient(query);
    expect(connectResponse.status).toEqual("OK");
    expect(connectResponse.data.id).toBeTruthy();
    const id = connectResponse.data.id;
    expect(api.connections.connections[id].fingerprint).toEqual(fingerprint);
    client.disconnect();
  });

  test("should not exist when web server has not been called", async () => {
    const { client, connectResponse } = await connectClient();
    expect(connectResponse.status).toEqual("OK");
    expect(connectResponse.data.id).toBeTruthy();
    const id = connectResponse.data.id;
    expect(api.connections.connections[id].fingerprint).not.toEqual(
      fingerprint
    );
    client.disconnect();
  });

  test("should exist as long as cookie is passed", async () => {
    const query = `${config.web.fingerprintOptions.cookieKey}=dummyValue`;
    const { client, connectResponse } = await connectClient(query);
    expect(connectResponse.status).toEqual("OK");
    expect(connectResponse.data.id).toBeTruthy();
    const id = connectResponse.data.id;
    expect(api.connections.connections[id].fingerprint).toEqual("dummyValue");
    client.disconnect();
  });
});
