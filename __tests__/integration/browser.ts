/**
 * @jest-environment jest-environment-webdriver
 */

import * as path from "path";
import { Process, config } from "./../../src/index";
const packageJSON = require(path.join(__dirname, "..", "..", "package.json"));

const actionhero = new Process();
let api;
let url;

// stub the selenium infected variables
declare var browser: any;
declare var by: any;

const ensureNoErrors = async () => {
  const errorMessage = await browser.findElement(by.id("error")).getText();
  if (errorMessage) {
    throw new Error(errorMessage);
  }
};

describe("browser integration tests", () => {
  beforeAll(async () => {
    api = await actionhero.start();
    await api.redis.clients.client.flushdb();
    url = "http://localhost:" + config.servers.web.port;
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  describe("default index page", () => {
    beforeAll(async () => {
      await browser.get(url);
      await ensureNoErrors();
      await browser.sleep(1000);
    });

    test("loads the page", async () => {
      const title = await browser.findElement(by.tagName("h1")).getText();
      expect(title).toEqual("Your Actionhero Server is working.");
    });

    test("server status is loaded", async () => {
      const serverName = await browser
        .findElement(by.id("serverName"))
        .getText();
      expect(serverName).toEqual("actionhero");
      const actionheroVersion = await browser
        .findElement(by.id("actionheroVersion"))
        .getText();
      expect(actionheroVersion).toEqual(packageJSON.version);
    });

    test("documentation is loaded", async () => {
      const actionNameElements = await browser.findElements(by.tagName("h3"));
      const actionNames = [];
      for (const i in actionNameElements) {
        actionNames.push(await actionNameElements[i].getText());
      }

      const expextedActions = [
        "cacheTest v1",
        "createChatRoom v1",
        "randomNumber v1",
        "showDocumentation v1",
        "sleepTest v1",
        "status v1",
        "validationTest v1"
      ];

      expect(actionNames).toEqual(expect.arrayContaining(expextedActions));
    });
  });

  describe("chat test page", () => {
    let sessionIDCookie;

    test("I can be assigned a session on another page", async () => {
      await browser.get(url);
      await ensureNoErrors();
      sessionIDCookie = await browser.manage().getCookie("sessionID");
      expect(sessionIDCookie.value).toBeTruthy();
    });

    describe("on the chat page", () => {
      beforeAll(async () => {
        await browser.get(`${url}/chat.html`);
        browser.sleep(1000);
      });

      afterAll(async () => {
        // navigate away to close the WS connection
        await browser.get(url);
      });

      test("can connect", async () => {
        const chat = await browser.findElement(by.id("chatBox")).getText();
        expect(chat).toContain("Hello! Welcome to the actionhero api");
      });

      test("can chat", async () => {
        const chatForm = await browser.findElement(by.id("message"));
        await chatForm.sendKeys("hello world");
        const chatSumbit = await browser.findElement(by.id("submitButton"));
        await chatSumbit.click();

        browser.sleep(1000);
        const chat = await browser.findElement(by.id("chatBox")).getText();
        expect(chat).toContain("hello world");
      });

      test("has the same fingerprint", async () => {
        const thisSessionID = await browser.manage().getCookie("sessionID");
        expect(thisSessionID.value).toEqual(sessionIDCookie.value);
        const fingerprintFromWebSocket = await browser
          .findElement(by.id("fingerprint"))
          .getText();
        expect(fingerprintFromWebSocket).toEqual(sessionIDCookie.value);
      });
    });
  });
});
