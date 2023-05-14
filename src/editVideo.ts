import ffmpeg, { FilterSpecification } from "fluent-ffmpeg";
import { join } from "path";
import mergeMp3Files from "./mergeMp3Files";
import Screenshoter from "./Screenshoter";

export interface ScreenshotWithSpeechFile {
  screenshot: string;
  speechFile: string;
  duration: number;
}

export async function editVideo(videoFile: string, mergedData: ScreenshotWithSpeechFile[]): Promise<string> {
  const complexFilter: Array<FilterSpecification> = [
    {
      filter: "amix",
      options: {
        inputs: "1", // 1 - background video MUST BE without audio
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
  ];

  const video = ffmpeg(join(__dirname, "..", "backgroundvideo", videoFile)).setStartTime(1);

  const mergedSpeechFilesPath = "audio.mp3";
  await mergeMp3Files(
    mergedData.map((data) => data.speechFile),
    mergedSpeechFilesPath
  );

  video.addInput(mergedSpeechFilesPath);

  let totalDuration = 0;
  for (const [index, data] of mergedData.entries()) {
    const mp3RoundedDuration = Number((data.duration / 1000).toFixed(3));
    video.addInput(data.screenshot);

    const filter: FilterSpecification = {
      filter: "overlay",
      inputs: index === 0 ? "cropped" : `overlay${index - 1}`,
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

  const outputFilePath = new Date().toISOString().slice(0, 10) + videoFile;

  video.setDuration(totalDuration).complexFilter(complexFilter).output(outputFilePath);

  console.log("Starting video editing...");

  return new Promise((resolve, reject) => {
    video
      .on("end", function (err) {
        if (!err) {
          console.log("Video conversion done");

          //runs in background
          Screenshoter.removeScreenshots();

          resolve(outputFilePath);
        }
      })
      .on("errors", (err) => {
        reject(err);
      })
      .run();
  });
}
