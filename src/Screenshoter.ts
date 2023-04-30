import { Page, Browser, launch } from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

export default class Screenshoter {
  private browser: Browser;
  private page: Page;

  public async init(url: string) {
    this.browser = await launch({
      executablePath: process.env.CHROME_PATH,
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--single-process",
        "--headless",
        "--disable-gpu",
        "--disable-sync",
      ],
      ignoreDefaultArgs: ["--disable-extensions"],
    });

    await this.gotoPage(url);
  }

  public async screenshotPage(url: string) {
    const page = await this.browser.newPage();

    await page.emulateMediaFeatures([
      {
        name: "prefers-color-scheme",
        value: "dark",
      },
    ]);
    await page.setViewport({
      width: 1920,
      height: 1080,
    });
    await page.goto(url);
    const screenshot = await page.screenshot({
      path: "./tmp/screenshot.png",
    });
    await page.close();
    return screenshot;
  }

  public async close() {
    await this.browser.close();
  }

  public async gotoPage(url: string) {
    const page = await this.browser.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    this.page = page;
  }

  public async takeScreenshotOfElement(selector: string, savePath: string) {
    const page = this.page;
    await page.emulateMediaFeatures([
      {
        name: "prefers-color-scheme",
        value: "dark",
      },
    ]);
    await page.setViewport({
      width: 1920,
      height: 1080,
    });
    const button = (
      await page.evaluateHandle(
        `document.querySelector("[id*='read-more-button']")`
      )
    ).asElement();
    button.click();

    await page.screenshot({
      path: "./tmp/screenshotb.png",
    });

    await page.waitForSelector("[id*='post-rtjson-content']");
    const element = await page.$("[id*='post-rtjson-content']");
    try {
      if (!element) {
        console.log("Element not found: " + selector);
      } else {
        await element.screenshot({
          path: savePath,
          captureBeyondViewport: true,
        });

        console.log("saved body");
      }
    } catch (e) {
      console.log("Error taking screenshot of element: " + selector, e);
    }
  }

  public async takeScreenshotOfComment(id: string, assetsDir: string) {
    const selector = `#${id}`;
    const savePath = `${assetsDir}/comments/${id}.png`;
    await this.takeScreenshotOfElement(selector, savePath);
    return { id: id, path: savePath };
  }

  public async takeScreenshotOfBody(assetsDir: string) {
    const selector = `[id*='post-rtjson-content']`;
    const savePath = `${assetsDir}/body.png`;
    await this.takeScreenshotOfElement(selector, savePath);
    return { id: "title", path: savePath };
  }

  public async takeScreenshotOfTitle(assetsDir: string) {
    const selector = '[slot="title"]';
    const savePath = `${assetsDir}/title.png`;
    await this.takeScreenshotOfElement(selector, savePath);
    return { id: "title", path: savePath };
  }
}
