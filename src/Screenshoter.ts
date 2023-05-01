import { Page, Browser, launch, TimeoutError, ElementHandle } from "puppeteer";
import dotenv from "dotenv";
dotenv.config();
import joinImages from "join-images";
import { join } from "path";
import fs from "node:fs/promises";

const selectors = {
  title: "[slot='title']",
  body: ".post-content [id*='post-rtjson-content'] p",
  header: "[slot='commentsPagePostDescriptor']",
  comment: "#id",
} as const;
const elements = ["title", "body", "header", "comment"] as const;
export type RedditElements = (typeof elements)[number];
const screenShotFolderPath = join(__dirname, "..", "screenshots");

export default class Screenshoter {
  private browser: Browser;
  private page: Page;
  private readonly viewPortWidth = 1920;
  private readonly viewPortHeight = 1080;

  constructor(private readonly paragraphsPerSlide: number) {}

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

  public static async removeScreenshots(filenameLike?: string) {
    for (const file of await fs.readdir(screenShotFolderPath)) {
      if (filenameLike) {
        if (file.includes(filenameLike)) {
          await fs.unlink(join(screenShotFolderPath, file));
        }
      } else {
        await fs.unlink(join(screenShotFolderPath, file));
      }
    }
  }

  public async close() {
    console.log("closing browser");
    await this.browser.close();
  }

  private async gotoPage(url: string) {
    const page = await this.browser.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
    });
    await page.emulateMediaFeatures([
      {
        name: "prefers-color-scheme",
        value: "dark",
      },
    ]);
    await page.setViewport({
      width: this.viewPortWidth,
      height: this.viewPortHeight,
    });

    //check if post was deleted
    try {
      await page.waitForSelector("[slot='post-message-banner']", {
        timeout: 2000,
      });
    } catch (e) {
      if (e instanceof TimeoutError) {
        console.log("Post available");
      } else {
        console.log("Post removed");
        //TODO what next?
      }
    }

    this.page = page;
  }

  public async takeScreenshotOfElement(elementName: RedditElements, savePath?: string) {
    const page = this.page;
    const selector = selectors[elementName];
    let element: ElementHandle<Element> | ElementHandle<Element>[] | null;

    await page.waitForSelector(selector);

    if (elementName === "body") {
      //handle read-more button to retrieve whole body of post
      try {
        const button = await page.evaluateHandle(`document.querySelector("[id*='read-more-button']")`);
        if (button) await button.asElement().click();

        //get all paragraphs from body
        element = await page.$$(selector);
      } catch (e) {}
    } else {
      element = await page.$(selector);
    }

    try {
      if (!element!) {
        console.log("Element not found: " + elementName);
      } else {
        if (Array.isArray(element)) {
          let tmpPaths: string[] = [];

          for (let i = 0; i < element.length; i++) {
            const path = join(screenShotFolderPath, `paragraph${i + 1}.png`);
            await element[i].screenshot({ path });

            tmpPaths.push(path);
            if (i > 0 && (i % this.paragraphsPerSlide === 0 || i === element.length - 1)) {
              await this.mergeParagraphPhotos(tmpPaths, i);
              tmpPaths = [];
            }
          }
        } else {
          await element.screenshot({
            path: savePath,
            captureBeyondViewport: true,
          });
        }

        console.log(`saved ${elementName} ${selector}`);
      }
    } catch (e) {
      console.log("Error taking screenshot of element: " + selector, e);
    }
  }

  public async takeScreenshotOfComment(id: string, assetsDir: string) {
    const savePath = `${assetsDir}/comments/${id}.png`;
    await this.takeScreenshotOfElement("comment", savePath);
    return { id: id, path: savePath };
  }

  public async takeScreenshotOfBody() {
    await this.takeScreenshotOfElement("body");
  }

  public async takeScreenshotOfTitleWithHeader() {
    const headerPath = `${screenShotFolderPath}/header.png`;
    await this.takeScreenshotOfElement("header", headerPath);

    const titlePath = `${screenShotFolderPath}/title.png`;
    await this.takeScreenshotOfElement("title", titlePath);

    const mergedTitleHeaderPath = `${screenShotFolderPath}/mergedHeaderTitle.png`;
    await mergeImages([headerPath, titlePath], mergedTitleHeaderPath, true);
    return { mergedTitleHeaderPath };
  }

  public async mergeParagraphPhotos(photosPath: string[], index: number) {
    const mergedPath = join(screenShotFolderPath, `body${index}.png`);
    await mergeImages(photosPath, mergedPath, true);
    return mergedPath;
  }
}

async function mergeImages(images: string[], savePath: string, deleteMergedImages?: boolean) {
  const mergedImages = await joinImages(images, {
    direction: "vertical",
    //colors from reddit's dark theme
    color: {
      r: 11,
      b: 20,
      g: 22,
    },
  });

  await mergedImages.toFile(savePath);

  if (deleteMergedImages) {
    for (const image of images) {
      await fs.unlink(image);
    }
  }
}
