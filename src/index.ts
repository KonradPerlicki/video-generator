import { TTScraper, Video } from "tiktok-scraper-ts";
const TikTokScraper = new TTScraper();
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();


import { https } from "follow-redirects";
import { google } from "googleapis";
//const OAuth2 = GoogleApis.auth;
import youtube from "youtube-api";
import CREDENTIALS from "../client_secret.json";
import { join } from "path";

const oauth = youtube.authenticate({
  type: "oauth",
  client_id: CREDENTIALS.web.client_id,
  client_secret: CREDENTIALS.web.client_secret,
  redirect_url: CREDENTIALS.web.redirect_uris[0],
});

const REFRESH_TOKEN = process.env.REFRESH_TOKEN as string;
const MAX_RETRIES = 5;
const DOWNLOADS_PREFIX = "/downloads";
const VIDEO_TITLE = "Random video";

(async () => {
  let video,
    iteration = 0;

  do {
    //https://www.tiktok.com/@zywicaa/video/7224553401462443290?is_from_webapp=1&sender_device=pc
    // second argument set to true to fetch the video without watermark
    //      "https://www.tiktok.com/@niedaltowskifinanse/video/7199662877551201542?is_from_webapp=1&sender_device=pc",

    video = await TikTokScraper.video(
      "https://www.tiktok.com/@niedaltowskifinanse/video/7199662877551201542?is_from_webapp=1&sender_device=pc",
      true
    );

    if (video) {
      console.log(video);
      await saveTiktokVideoFile(video);
    }

    iteration++;
  } while (!video && iteration < MAX_RETRIES);

  return;
})();

async function saveTiktokVideoFile(video: Video) {
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

      if (video.cover) {
        await saveTiktokThumbnail(video, videoFile);
      } else {
        await uploadVideoFileToYoutube(video, videoFile.path as string);
      }
    });

    videoFile.on("error", () => {
      fs.rmdirSync(DOWNLOADS_PREFIX + video.id);
    });
  });
}

async function saveTiktokThumbnail(video: Video, videoFile: fs.WriteStream) {
  const thumbnailFile = fs.createWriteStream(
    join(__dirname, "..", DOWNLOADS_PREFIX, video.id, video.id + ".jpg")
  );

  https.get(video.cover!, (response) => {
    if (response.statusCode != 200) {
      console.log(
        "Oops, got a " +
          response.statusCode +
          " while trying to download thumbnail for " +
          video.id
      );
      return;
    }

    response.pipe(thumbnailFile);

    // after download completed close filestream
    thumbnailFile.on("finish", async () => {
      thumbnailFile.close();
      console.log("Download cover completed");

      await uploadVideoFileToYoutube(
        video,
        videoFile.path as string,
        thumbnailFile.path as string
      );
    });
  });
}

async function uploadVideoFileToYoutube(
  video: Video,
  filePath: string,
  thumbnailPath?: string
) {
  oauth.setCredentials({
    refresh_token: REFRESH_TOKEN,
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
          description: `
            ${VIDEO_TITLE} #${folders.length}

            ${tags.join(" ")}`,
          tags,
          categoryId: "24", // Entertainment category
          thumbnails: {
            default: {
              url: "https://i.pravatar.cc/", //TODO sprawdzić czy trzeba pobierac miniatury
            },
          },
        },
        status: {
          embeddable: true,
          privacyStatus: "private",
          selfDeclaredMadeForKids: true,
        },
      },
      // required
      part: [],

      // Create the readable stream to upload the video
      media: {
        body: fs.createReadStream(filePath),
      },
    },
    (err, data) => {
      console.log(err, data);
      if (err) throw err;

      console.log(`Video #${folders.length} uploaded successfully`);
      console.log(err, data);
      process.exit();
    }
  );
}
