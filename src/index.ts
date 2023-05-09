import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import youtube from "youtube-api";
import CREDENTIALS from "../client_secret.json";
import { join } from "path";
import Screenshoter from "./Screenshoter";
import { ScreenshotWithSpeechFile, editVideo } from "./editVideo";
import Reddit from "./Reddit";
import getCompletedSpeechObjectsList from "./AWSPolly";
import { saveSpeechFiles } from "./AWSS3";
import getMP3Duration from "get-mp3-duration";
import { ListingChildren, Post } from "reddit-types";
import { launch } from "puppeteer";

const now = performance.now();

const DOWNLOADS_PREFIX = "/downloads";
const VIDEO_TITLE = "Random video";
const files = fs.readdirSync(join(__dirname, "..", "backgroundvideo"));
const PARAGRAPHS_PER_SLIDE = 4; //TODO refactor to base on text length
const backgroundVideo = files[0]; //TODO add more backgrounds, rotate them

(async () => {
  try {
    const reddit = new Reddit(PARAGRAPHS_PER_SLIDE);
    const postListing = await reddit.getListing();
    const post = postListing.children[0];
    const parapgraphsTextToSpeech = reddit.getDividedParagraphsFromPost(post.data);

    const [speechFilesList, screenshots] = await Promise.all([
      getCompletedSpeechObjectsList(parapgraphsTextToSpeech),
      getPostAllScreenshots(post),
    ]);

    if (!speechFilesList) {
      throw new Error(`No speech files`);
    }

    if (screenshots.length !== speechFilesList.length) {
      throw new Error(
        `Something went wrong for post: "${post.data.id}" with url: "${post.data.url}", reason: screenshots number didn't match speech files nubmer, found ${screenshots.length} screenshots and ${speechFilesList.length} speech files.`
      );
    }

    const mergedData: ScreenshotWithSpeechFile[] = screenshots.map((screenshot, index) => ({
      screenshot,
      speechFile: join(__dirname, "..", "mp3", speechFilesList[index]),
      duration: getMP3Duration(fs.readFileSync(join(__dirname, "..", "mp3", speechFilesList[index]))),
    }));

    const videoName = await editVideo(backgroundVideo, mergedData);

    //runs in background
    Screenshoter.removeScreenshots();

    //TODO upload video logic here promise all delete screenshots and upload
    console.log(`Done in ${performance.now() - now} ms`);
  } catch (e) {
    console.log(e);
  }
  return;
})();

async function getPostAllScreenshots(post: ListingChildren) {
  const screenshots: string[] = [];
  const screenshoter = new Screenshoter(PARAGRAPHS_PER_SLIDE);

  await screenshoter.init(post.data.url);

  const mergedTitleHeaderPath = await screenshoter.takeScreenshotOfTitleWithHeader();
  screenshots.push(mergedTitleHeaderPath);
  await screenshoter.takeScreenshotOfBody();
  screenshots.push(...screenshoter.getMergedBodyImagesPath());

  await screenshoter.close();
  return screenshots;
}

/* async function saveTiktokVideoFile(video) {
  const folderPath = join(__dirname, "..", DOWNLOADS_PREFIX, video.id);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  const videoFile = fs.createWriteStream(
    join(__dirname, "..", DOWNLOADS_PREFIX, video.id, video.id + ".mp4")
  );

  https.get(video.downloadURL, (response) => {
    if (response.statusCode != 200) {
      console.log(
        "Oops, got a " +
          response.statusCode +
          " while trying to download video file for " +
          video.id
      );
      return;
    }

    response.pipe(videoFile);

    // after download completed close filestream
    videoFile.on("finish", async () => {
      videoFile.close();
      console.log("Download video completed");

      //await uploadVideoFileToYoutube(video, videoFile.path as string);
    });

    videoFile.on("error", () => {
      fs.rmdirSync(DOWNLOADS_PREFIX + video.id);
    });
  });
} */

async function uploadVideoFileToYoutube(video: any, filePath: string) {
  const oauth = youtube.authenticate({
    type: "oauth",
    client_id: CREDENTIALS.web.client_id,
    client_secret: CREDENTIALS.web.client_secret,
    redirect_url: CREDENTIALS.web.redirect_uris[0],
  });

  oauth.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
  });

  const accessToken = await oauth.getAccessToken();
  if (!accessToken.token) {
    throw new Error("Didn't get access token");
  }

  oauth.setCredentials({
    access_token: accessToken.token,
  });

  const folders = fs.readdirSync(join(__dirname, "..", DOWNLOADS_PREFIX));

  const isShort = video.duration <= 60;
  const tags = video.description.match(/#\w+/g) ?? (isShort ? ["#Shorts"] : []);

  youtube.videos.insert(
    {
      requestBody: {
        // Video information
        snippet: {
          title: `${VIDEO_TITLE} #${folders.length}`,
          // Append #Short tag to video description
          description: `${VIDEO_TITLE} #${folders.length}

          ${tags.join(" ")}`,
          tags,
          categoryId: "24", // Entertainment category
        },
        status: {
          embeddable: true,
          privacyStatus: "private",
          selfDeclaredMadeForKids: true,
        },
      },
      // required
      part: ["snippet", "status"],

      // Create the readable stream to upload the video
      media: {
        body: fs.createReadStream(filePath),
      },
    },
    (err, data) => {
      if (err) throw err;

      console.log(`Video #${folders.length} uploaded successfully`);
      process.exit();
    }
  );
}
