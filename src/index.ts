import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import youtube from "youtube-api";
import CREDENTIALS from "../client_secret.json";
import { join } from "path";
import Screenshoter from "./Screenshoter";
import { ScreenshotWithSpeechData, createVideo } from "./createVideo";
import Reddit from "./Reddit";
import getCompletedSpeechObjectsList from "./AWSPolly";
import getMP3Duration from "get-mp3-duration";
import { checkAccessToken, db } from "./utils";
import { removeSpeechFiles } from "./AWSS3";

const now = performance.now();

const oauth = youtube.authenticate({
  type: "oauth",
  client_id: CREDENTIALS.web.client_id,
  client_secret: CREDENTIALS.web.client_secret,
  redirect_url: CREDENTIALS.web.redirect_uris[0],
});

oauth.setCredentials({
  refresh_token: db.refresh_token,
});

(async () => {
  try {
    await checkAccessToken(oauth);

    const reddit = new Reddit();
    const post = await reddit.getFirstPostWithLength("stories", Number(process.env.VIDEO_LENGTH));
    if (!post) process.exit();

    const screenshoter = new Screenshoter();

    const parapgraphsWithTextToSpeech = reddit.getDividedParagraphsFromPost(post);

    const [speechFilesList, screenshots] = await Promise.all([
      getCompletedSpeechObjectsList(parapgraphsWithTextToSpeech),
      screenshoter.getPostAllScreenshots(post),
    ]);

    if (screenshots.length !== speechFilesList.length) {
      throw new Error(
        `Something went wrong for post: "${post.id}" with url: "${post.url}", reason: screenshots number didn't match speech files nubmer, found ${screenshots.length} screenshots and ${speechFilesList.length} speech files.`
      );
    }

    const screenshotWithSpeechData: ScreenshotWithSpeechData[] = screenshots.map((screenshot, index) => ({
      screenshot,
      speechFile: join(__dirname, "..", "mp3", speechFilesList[index]),
      duration: getMP3Duration(fs.readFileSync(join(__dirname, "..", "mp3", speechFilesList[index]))),
    }));

    const videoName = await createVideo(screenshotWithSpeechData);

    //uploading video to youtube
    const tags = [`#${post.subreddit}`, "#reddit", "#redditstory", "#redditstories", "#top", "#trending"];
    const date = new Date();

    console.log(`Uploading video to youtube...`);

    const postTitleFirstSentence = post.title.match(/^(.*?)[.?!]\s/);
    const title = `#${db.video_id} ${process.env.VIDEO_TITLE} - ${
      postTitleFirstSentence ? postTitleFirstSentence[0] : post.title
    }`;

    youtube.videos.insert(
      {
        requestBody: {
          // Video information
          snippet: {
            title: title.length > 100 ? title.slice(0, 99) + "…" : title,
            description: `${post.title}
This is #1 top post from subreddit ${post.subreddit_name_prefixed}   
Post's author: ${post.author} 
Upvotes: ${post.ups}
Downvotes: ${post.downs}
Comments: ${post.num_comments}
Uploaded on: ${date.toISOString().slice(0, 10)} ${date.getHours()}:${date.getMinutes()}

--------------------------
Sources:
- Reddit post: ${post.url.replace("https://", "")}
- Beautiful background from ${videoName.slice(0, -4).trim()}

${tags.join(" ")}`,
            tags,
            categoryId: "24", // Entertainment category
          },
          status: {
            embeddable: true,
            privacyStatus: "private",
            selfDeclaredMadeForKids: !post.over_18,
          },
        },
        // required
        part: ["snippet", "status"],
        // Create the readable stream to upload the video
        media: {
          body: fs.createReadStream(videoName),
        },
      },
      (err, data) => {
        if (err) throw err;
        console.log(`Video ${process.env.VIDEO_TITLE} #${db.video_id} uploaded successfully`);

        db.video_id = db.video_id + 1;

        console.log(`Done in ${performance.now() - now} ms`);
        process.exit();
      }
    );
  } catch (e: any) {
    console.log("Error thrown: " + e.message);
  } finally {
    console.log("Cleaning all files... ");
    await Screenshoter.removeScreenshots();
    await removeSpeechFiles();
  }
})();
