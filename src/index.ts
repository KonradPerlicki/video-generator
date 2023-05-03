import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import youtube from "youtube-api";
import CREDENTIALS from "../client_secret.json";
import { join } from "path";
import qs from "qs";
import axios from "axios";
import { Listing } from "reddit-types";
import Screenshoter from "./Screenshoter";
import { editVideo } from "./editVideo";

const DOWNLOADS_PREFIX = "/downloads";
const VIDEO_TITLE = "Random video";
const files = fs.readdirSync(join(__dirname, "..", "backgroundvideo"));
const PARAGRAPHS_PER_SLIDE = 4; //TODO refactor to base on text length
const backgroundVideo = files[0]; //TODO add more backgrounds, rotate them

(async () => {
  try {
    const overlayImages: string[] = [];
    const screenshoter = new Screenshoter(PARAGRAPHS_PER_SLIDE);
    await screenshoter.init(
      "https://www.reddit.com/r/nosleep/comments/133t6o0/should_we_cancel_the_book_burning_disturbing/"
    );

    const mergedTitleHeaderPath = await screenshoter.takeScreenshotOfTitleWithHeader();
    overlayImages.push(mergedTitleHeaderPath);

    await screenshoter.takeScreenshotOfBody();
    overlayImages.push(...screenshoter.getMergedBodyImagesPath());

    await screenshoter.close();

    await editVideo(backgroundVideo, overlayImages);
  } catch (e) {
    console.log(e);
  }
  return;
  const credentials = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString("base64");

  const data = qs.stringify({
    grant_type: "refresh_token",
    username: process.env.REDDIT_USERNAME,
    refresh_token: process.env.REFRESH_TOKEN,
  });

  try {
    const accessTokenResponse = await axios({
      method: "post",
      url: "https://www.reddit.com/api/v1/access_token",
      headers: {
        Authorization: "Basic " + credentials,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data,
    });

    if (accessTokenResponse.data.access_token) {
      const accessToken = accessTokenResponse.data.access_token;

      const postListing = await axios<Listing>({
        method: "get",
        url: "https://oauth.reddit.com/r/nosleep/top",
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });
      if (postListing.data) {
        const data = postListing.data.data;
        const posts = data.children;
        console.log(postListing.data);
      } else {
        console.log("An error occured while getting list of posts...");
        process.exit();
      }
    } else {
      console.log("Something went wrong... access token does not exist in response");
      process.exit();
    }
  } catch (e: unknown) {
    console.log(e);
    process.exit();
  }

  return;
})();

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
