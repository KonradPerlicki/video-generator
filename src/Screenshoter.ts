import { Page, Browser, launch, TimeoutError, ElementHandle } from "puppeteer";
import dotenv from "dotenv";
dotenv.config();
import joinImages from "join-images";
import { join } from "path";
import fs from "node:fs/promises";
import sharp from "sharp";

const selectors = {
  title: "[slot='title']",
  body: "[slot='text-body'] [id*='post-rtjson-content'] p",
  header: "[slot='credit-bar']",
  comment: "#id",
} as const;
const elements = ["title", "body", "header", "comment"] as const;
export type RedditElements = (typeof elements)[number];
const screenshotsFolder = join(__dirname, "..", "screenshots");

export default class Screenshoter {
  private browser: Browser;
  private page: Page;
  private readonly viewPortWidth = 500;
  private readonly viewPortHeight = 1080;
  private mergedBodyImagesPath: string[] = [];

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
    console.log(
      filenameLike ? `Removing screenshots with ${filenameLike} in filename` : "Removing all screenshots..."
    );

    for (const file of await fs.readdir(screenshotsFolder)) {
      if (filenameLike) {
        if (file.includes(filenameLike)) {
          await fs.unlink(join(screenshotsFolder, file));
        }
      } else {
        await fs.unlink(join(screenshotsFolder, file));
      }
    }

    console.log("Screenshots removed");
  }

  public async close() {
    console.log("Closing browser...");
    await this.browser.close();
    console.log("Browser closed");
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
        console.log("Post available... ");
      } else {
        console.log("Post removed");
        //TODO what next?
      }
    }

    this.page = page;
  }

  public getMergedBodyImagesPath() {
    return this.mergedBodyImagesPath;
  }

  public async takeScreenshotOfElement(elementName: RedditElements, filename: string) {
    const page = this.page;
    const selector = selectors[elementName];
    let element: ElementHandle<Element> | ElementHandle<Element>[] | null;

    console.log("Waiting for selector...");
    await page.waitForSelector(selector);
    console.log("Selector found");

    if (elementName === "body") {
      //handle read-more button to retrieve whole body of post
      try {
        console.log("Revealing the whole post content...");
        const button = await page.evaluateHandle(`document.querySelector("[id*='read-more-button']")`);
        if (button) await button.asElement().click();
        console.log("OK");
      } catch (e) {
        console.log("Something went wrong while revealing the post content: ", e);
      }

      //get all paragraphs from body
      console.log(`Retrieving all paragraphs ${elementName}...`);
      element = await page.$$(selector);
    } else {
      console.log(`Retrieving the selector ${elementName}...`);
      element = await page.$(selector);
    }

    console.log("OK");

    try {
      if (!element) {
        console.log("Element not found: " + elementName);
      } else {
        if (Array.isArray(element)) {
          await this.takeScreenshotsOfBodyParagraphs(element, filename);
        } else {
          await element.screenshot({
            path: join(screenshotsFolder, filename),
            captureBeyondViewport: true,
          });
        }

        console.log(`Successfully saved ${elementName}`);
      }
    } catch (e) {
      console.log(`Error taking screenshot of element: ${elementName}`, e);
    }
  }

  private async takeScreenshotsOfBodyParagraphs(element: ElementHandle<Element>[], filename: string) {
    let tmpPaths: string[] = [];

    console.log("Starting taking body's screenshots...");

    for (let i = 0; i < element.length; i++) {
      const path = join(screenshotsFolder, `${filename}${i + 1}.png`);
      await element[i].screenshot({ path });

      tmpPaths.push(path);
      if (tmpPaths.length === this.paragraphsPerSlide) {
        await this.mergeParagraphPhotos(tmpPaths, i);
        tmpPaths = [];
      }
    }

    //in case when total number of elements is not dividable by this.paragraphsPerSlide
    if (tmpPaths.length > 0) {
      await this.mergeParagraphPhotos(tmpPaths, element.length);
    }

    console.log("Finished");
  }

  //TODO
  public async takeScreenshotOfComment(id: string, assetsDir: string) {
    const savePath = `${assetsDir}/comments/${id}.png`;
    await this.takeScreenshotOfElement("comment", savePath);
    return { id: id, path: savePath };
  }

  public async takeScreenshotOfBody() {
    await this.takeScreenshotOfElement("body", "paragraph");
  }

  public async takeScreenshotOfTitleWithHeader() {
    const headerName = `header.png`;
    await this.takeScreenshotOfElement("header", headerName);

    const titleName = `title.png`;
    await this.takeScreenshotOfElement("title", titleName);

    const mergedTitleHeaderPath = `mergedHeaderTitle.png`;

    await this.mergeImages(
      [join(screenshotsFolder, headerName), join(screenshotsFolder, titleName)],
      mergedTitleHeaderPath
    );

    return join(screenshotsFolder, mergedTitleHeaderPath);
  }

  public async mergeParagraphPhotos(photosPath: string[], index: number) {
    const filename = `body${index}.png`;
    this.mergedBodyImagesPath.push(join(screenshotsFolder, filename));
    await this.mergeImages(photosPath, filename);
  }

  private async mergeImages(images: string[], filename: string, deleteMergedImages = true) {
    const mergedImages = await joinImages(images, {
      direction: "vertical",
      //colors from reddit's dark theme
      color: {
        r: 11,
        b: 20,
        g: 22,
      },
    });

    await mergedImages.toFile("tmp.png");
    await sharp("tmp.png").resize(680).toFile(join(screenshotsFolder, filename));
    await fs.unlink("tmp.png");

    if (deleteMergedImages) {
      for (const image of images) {
        await fs.unlink(image);
      }
    }
  }
}
