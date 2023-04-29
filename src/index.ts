import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import https from "https";
//import { http, https } from "follow-redirects";
//import { google } from "googleapis";
//const OAuth2 = GoogleApis.auth;
import youtube from "youtube-api";
import CREDENTIALS from "../client_secret.json";
import { join } from "path";
import Reddit from "reddit";

import Snoowrap from "snoowrap";
/* const r = new Snoowrap({
  userAgent: "MyApp v0.1",
  username: process.env.USERNAME as string,
  password: process.env.PASS as string,
  clientId: process.env.APP_ID as string,
  clientSecret: process.env.APP_SECRET as string,
  refreshToken: process.env.REFRESH_TOKEN as string,
}); */

const reddit = new Reddit({
  username: process.env.USERNAME as string,
  password: process.env.PASS as string,
  appId: process.env.APP_ID as string,
  appSecret: process.env.APP_SECRET as string,
});

//import fetch from "node-fetch";

const REFRESH_TOKEN = process.env.REFRESH_TOKEN as string;
const MAX_RETRIES = 5;
const DOWNLOADS_PREFIX = "/downloads";
const VIDEO_TITLE = "Random video";
import open from "open";
import axios from "axios";
(async () => {
  let video,
    iteration = 0;
  const credentials = Buffer.from(
    `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
  ).toString("base64");

  var qs = require("qs");
  var data = qs.stringify({
    grant_type: "refresh_token",
    username: process.env.USERNAME,
    refresh_token: REFRESH_TOKEN,
  });
  var config = {
    method: "post",
    url: "https://www.reddit.com/api/v1/access_token",
    headers: {
      Authorization: "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: data,
  };

  axios(config)
    .then(async function (response) {
      const res = response.data;

      let abc = await axios({
        method: "get",
        url: "https://oauth.reddit.com/r/nosleep/top",
        headers: {
          Authorization: "Bearer " + res.access_token,
        },
      });
      console.log(abc);
    })
    .catch(function (error) {
      console.log(error);
    });

  /* 
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    data: {
    },
  }); */
  /* const response = await reddit.post("api/v1/access_token", {
  });
 ; */ //console.log(t);

  //do {"/r/nosleep/top"

  /* if (video) {
    console.log(video);
    //await saveTiktokVideoFile(video);
  } */

  iteration++;
  //} while (!video && iteration < MAX_RETRIES);

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
