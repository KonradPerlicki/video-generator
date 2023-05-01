import ffmpeg from "fluent-ffmpeg";
import { join } from "path";
import Screenshoter from "./Screenshoter";

export async function editVideo(videoFile: string, screenshots: string[]) {
  const video = ffmpeg(join(__dirname, "..", "backgroundvideo", videoFile))
    .setStartTime("00:00:01")
    .setDuration("8");

  for (const screenshot of screenshots) {
    video.addInput(screenshot);
  }

  video
    .complexFilter([
      {
        filter: "scale",
        options: {
          w: "-1",
          h: "1280",
        },
        outputs: "scaled",
      },
      {
        filter: "crop",
        options: { w: "min(720,1*ih)", h: "min(iw/1,ih)" },
        outputs: "cropped",
        inputs: "scaled",
      },
      {
        filter: "boxblur",
        options: {
          luma_power: 10,
        },
        outputs: "blurred",
        inputs: "cropped",
      },
      {
        filter: "overlay",
        inputs: "blurred",
        options: {
          enable: "between(t,2.5,4)",
        },
        outputs: "first",
      },
      {
        filter: "overlay",
        inputs: "first",
        options: {
          enable: "between(t,4.5,6)",
        },
      },
    ])
    .output("video_out.mp4")
    .on("end", async function (err) {
      if (!err) {
        console.log("Video conversion done");
        await Screenshoter.removeScreenshots();
      }
    })
    .on("errors", (err) => console.log("error: ", err))
    .run();
}
