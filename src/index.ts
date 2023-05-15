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
import getMP3Duration from "get-mp3-duration";
import { ListingChildren } from "reddit-types";
import express from "express";
import kfs from "key-file-storage";
import { GetAccessTokenResponse } from "google-auth-library/build/src/auth/oauth2client";
const db = kfs(join(__dirname, "..", "db"));

const now = performance.now();

const VIDEO_TITLE = "Reddit story";
const PARAGRAPHS_PER_SLIDE = 4; //TODO refactor to base on text length

const oauth = youtube.authenticate({
  type: "oauth",
  client_id: CREDENTIALS.web.client_id,
  client_secret: CREDENTIALS.web.client_secret,
  redirect_url: CREDENTIALS.web.redirect_uris[0],
});

oauth.setCredentials({
  refresh_token: db.refresh_token,
});

let accessToken: GetAccessTokenResponse;

(async () => {
  try {
    try {
      //will crash first if refresh token is invalid
      accessToken = await oauth.getAccessToken();
      if (!accessToken.token) {
        throw new Error("Didn't get access token");
      }
    } catch (e: unknown | object) {
      if (e && typeof e === "object" && "code" in e && e.code === "400") {
        const authUrl = oauth.generateAuthUrl({
          access_type: "offline",
          scope: ["https://www.googleapis.com/auth/youtube.upload"],
        });

        //need manual open url
        console.log(authUrl);

        const app = express();
        app.get("/redirect", (req, res) => {
          oauth.getToken(String(req.query.code), (err, tokens) => {
            if (tokens) {
              db.refresh_token = tokens.refresh_token;
              console.log("Refresh token saved");
              process.exit();
            }
          });
        });
        app.listen(process.env.PORT);
      }
    }

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

    const videoName = await editVideo(mergedData);

    await uploadVideoFileToYoutube(videoName, post);
  } catch (e) {
    console.log(e);
  }
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

async function uploadVideoFileToYoutube(filePath: string, post: ListingChildren) {
  oauth.setCredentials({
    access_token: accessToken.token,
  });

  const tags = [`#${post.data.subreddit}`, "#reddit", "#redditstory", "#redditstories", "#top", "#trending"];
  const date = new Date();

  console.log(`Uploading video to youtube...`);

  const title = `#${db.video_id} ${VIDEO_TITLE} - ${post.data.title.match(/^(.*?)[.?!]\s/)![0]}`;

  youtube.videos.insert(
    {
      requestBody: {
        // Video information
        snippet: {
          title: title.length > 100 ? title.slice(0, 99) + "…" : title,
          description: `${post.data.title}
This is #1 top post from subreddit ${post.data.subreddit_name_prefixed}   
Post's author: ${post.data.author} 
Upvotes: ${post.data.ups}
Downvotes: ${post.data.downs}
Comments: ${post.data.num_comments}
Uploaded on: ${date.toISOString().slice(0, 10)} ${date.getHours()}:${date.getMinutes()}

--------------------------
Sources:
- Reddit post: ${post.data.url}
- Beautiful background from ${filePath.slice(0, -4).trim()}

${tags.join(" ")}`,
          tags,
          categoryId: "24", // Entertainment category
        },
        status: {
          embeddable: true,
          privacyStatus: "private",
          selfDeclaredMadeForKids: !post.data.over_18,
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
      console.log(`Video ${VIDEO_TITLE} #${db.video_id} uploaded successfully`);

      db.video_id = db.video_id + 1;

      console.log(`Done in ${performance.now() - now} ms`);
      process.exit();
    }
  );
}
