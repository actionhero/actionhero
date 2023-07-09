import * as path from "path";
import * as fs from "fs";
import * as Puppeteer from "puppeteer";
import { api, Process, config, utils } from "../../src/index";
import { PackageJson } from "type-fest";

const packageJSON: PackageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json")).toString(),
);

let browser: Puppeteer.Browser;
let page: Puppeteer.Page;
let url: string;

describe("browser integration tests", () => {
  let actionhero: Process;

  beforeAll(async () => {
    actionhero = new Process();
    await actionhero.start();
    await api.redis.clients.client.flushdb();
    browser = await Puppeteer.launch({
      headless: "new",
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
      url = `http://localhost:${config.web!.port}`;
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
        (e) => e.textContent,
      );
      expect(actionheroVersion).toEqual(packageJSON.version);
    });
  });

  describe("swagger page", () => {
    beforeAll(() => {
      url = `http://localhost:${config.web!.port}/swagger.html`;
    });

    test("loads the page", async () => {
      await page.goto(url);
      await page.waitForSelector("h2");
      const title = await page.$eval("h2", (e) => e.textContent);
      expect(title).toMatch(/^actionhero/);
    });

    test("documentation is loaded", async () => {
      await page.goto(url);
      await page.waitForSelector("h3");
      const actionNames = await page.$$eval("h3", (elements) =>
        elements.map((e) => e.textContent),
      );
      expect(actionNames.sort()).toEqual([
        "createChatRoom",
        "status",
        "swagger",
      ]);
    });
  });

  describe("chat test page", () => {
    let sessionIDCookie: Puppeteer.Protocol.Network.Cookie;

    test("I can be assigned a session on another page", async () => {
      sessionIDCookie = (await page.cookies()).filter(
        (c) => c.name === "sessionID",
      )[0];
      expect(sessionIDCookie.value).toBeTruthy();
    });

    describe("on the chat page", () => {
      beforeAll(() => {
        url = `http://localhost:${config.web!.port}/chat.html`;
      });

      test("can connect", async () => {
        await page.goto(url);
        await utils.sleep(2000);
        const chat = await page.$eval("#chatBox", (e) => e.textContent);
        expect(chat).toContain("Welcome to the actionhero api");
      });

      test("can chat", async () => {
        const chatForm = await page.$("#message");
        await chatForm!.type("hello world");
        const chatSubmit = await page.$("#submitButton");
        await chatSubmit!.click();

        await utils.sleep(1000);

        const chat = await page.$eval("#chatBox", (e) => e.textContent);
        expect(chat).toContain("hello world");
      });

      test("has the same fingerprint", async () => {
        const thisSessionID = (await page.cookies()).filter(
          (c) => c.name === "sessionID",
        )[0];
        expect(thisSessionID.value).toEqual(sessionIDCookie.value);
        const fingerprintFromWebSocket = await page.$eval(
          "#fingerprint",
          (e) => e.textContent,
        );
        expect(fingerprintFromWebSocket).toEqual(sessionIDCookie.value);
      });
    });
  });
});
