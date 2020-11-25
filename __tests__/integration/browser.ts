import * as path from "path";
import * as fs from "fs";
import * as puppeteer from "puppeteer";
import { api, Process, config, utils } from "../../src/index";
const packageJSON = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json")).toString()
);
const host = "localhost";

const actionhero = new Process();
let browser: puppeteer.Browser;
let page: puppeteer.Page;
let url: string;

describe("browser integration tests", () => {
  beforeAll(async () => {
    await actionhero.start();
    await api.redis.clients.client.flushdb();
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
    await actionhero.stop();
  });

  describe("default index page", () => {
    beforeAll(() => {
      url = `http://${host}:${config.servers.web.port}`;
    });

    test("loads the page", async () => {
      await page.goto(url);
      await utils.sleep(1000);
      const title = await page.$eval("h1", (e) => e.textContent);
      expect(title).toEqual("Your Actionhero Server is working.");
    });

    test("server status is loaded", async () => {
      await page.goto(url);
      await page.waitForSelector("#serverName");
      const serverName = await page.$eval("#serverName", (e) => e.textContent);
      expect(serverName).toEqual("actionhero");

      const actionheroVersion = await page.$eval(
        "#actionheroVersion",
        (e) => e.textContent
      );
      expect(actionheroVersion).toEqual(packageJSON.version);
    });
  });

  describe("swagger page", () => {
    beforeAll(() => {
      url = `http://${host}:${config.servers.web.port}/swagger.html`;
    });

    test("loads the page", async () => {
      await page.goto(url);
      await page.waitForSelector("h2");
      const title = await page.$eval("h2", (e) => e.textContent);
      expect(title).toMatch(/^actionhero/);
    });

    test("documentation is loaded", async () => {
      await page.goto(url);
      await page.waitForSelector("h4");
      const actionNames = await page.$$eval("h4", (elements) =>
        elements.map((e) => e.textContent)
      );
      expect(actionNames.sort()).toEqual([
        "createChatRoom",
        "status",
        "swagger",
      ]);
    });
  });

  describe("chat test page", () => {
    let sessionIDCookie;

    test("I can be assigned a session on another page", async () => {
      sessionIDCookie = (await page.cookies()).filter(
        (c) => c.name === "sessionID"
      )[0];
      expect(sessionIDCookie.value).toBeTruthy();
    });

    describe("on the chat page", () => {
      beforeAll(() => {
        url = `http://${host}:${config.servers.web.port}/chat.html`;
      });

      test("can connect", async () => {
        await page.goto(url);
        await utils.sleep(2000);
        const chat = await page.$eval("#chatBox", (e) => e.textContent);
        expect(chat).toContain("Hello! Welcome to the actionhero api");
      });

      test("can chat", async () => {
        await page.goto(url);
        const chatForm = await page.$("#message");
        await chatForm.type("hello world");
        const chatSubmit = await page.$("#submitButton");
        await chatSubmit.click();

        await utils.sleep(1000);

        const chat = await page.$eval("#chatBox", (e) => e.textContent);
        expect(chat).toContain("hello world");
      });

      test("has the same fingerprint", async () => {
        const thisSessionID = (await page.cookies()).filter(
          (c) => c.name === "sessionID"
        )[0];
        expect(thisSessionID.value).toEqual(sessionIDCookie.value);
        const fingerprintFromWebSocket = await page.$eval(
          "#fingerprint",
          (e) => e.textContent
        );
        expect(fingerprintFromWebSocket).toEqual(sessionIDCookie.value);
      });
    });
  });
});
