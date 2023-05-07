import ffmpeg, { FilterSpecification } from "fluent-ffmpeg";
import { join } from "path";
import Screenshoter from "./Screenshoter";

export interface ScreenshotWithSpeechFile {
  screenshot: string;
  speechFile: string;
  duration: number;
}

export async function editVideo(videoFile: string, mergedData: ScreenshotWithSpeechFile[]) {
  const complexFilter: Array<FilterSpecification> = [
    {
      filter: "amix",
      options: {
        inputs: "2",
      },
    },
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
  ];

  const video = ffmpeg(join(__dirname, "..", "backgroundvideo", videoFile)).setStartTime(21);
  video.addInput(mergedData[0].speechFile);

  let totalDuration = 0;
  for (const [index, data] of mergedData.entries()) {
    const mp3RoundedDuration = Number((data.duration / 1000).toFixed(3));
    video.addInput(data.screenshot);

    const filter: FilterSpecification = {
      filter: "overlay",
      inputs: index === 0 ? "blurred" : `overlay${index - 1}`,
      options: {
        y: "(H-h)/2",
        x: "(W-w)/2",
        enable: `between(t,${totalDuration},${totalDuration + mp3RoundedDuration})`,
      },
      outputs: `overlay${index}`,
    };
    totalDuration += mp3RoundedDuration;

    //last filter must be without output property
    if (index === mergedData.length - 1) {
      delete filter.outputs;
    }

    complexFilter.push(filter);
  }
  console.log(complexFilter);

  console.log("Starting video editing...");

  video
    .setDuration(3)
    .complexFilter(complexFilter)
    .output("video_out.mp4")
    .on("end", async function (err) {
      if (!err) {
        console.log("Video conversion done");
        //await Screenshoter.removeScreenshots();
        //TODO upload video logic here promise all delete screenshots and upload
      }
    })
    .on("errors", (err) => console.log("error: ", err))
    .run();
}
