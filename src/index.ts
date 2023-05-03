import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import youtube from "youtube-api";
import CREDENTIALS from "../client_secret.json";
import { join } from "path";
import Screenshoter from "./Screenshoter";
import { editVideo } from "./editVideo";
import Reddit from "./Reddit";

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
    console.log(reddit.getDividedParagraphsFromPost(post.data));

    const screenshoter = new Screenshoter(PARAGRAPHS_PER_SLIDE);
    const overlayImages: string[] = [];
    await screenshoter.init(
      "https://www.reddit.com/r/nosleep/comments/136h7ay/i_have_the_ability_to_understand_animals_today/"
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
