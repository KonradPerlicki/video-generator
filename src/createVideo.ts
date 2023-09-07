import ffmpeg, { FilterSpecification } from "fluent-ffmpeg";
import { join } from "path";
import mergeMp3Files from "./mergeMp3Files";
import fs from "fs";
import getMP3Duration from "get-mp3-duration";
import { getVideoDurationInSeconds } from "get-video-duration";

export interface ScreenshotWithSpeechData {
  screenshot: string;
  speechFile: string;
  duration: number;
}

export async function createVideo(mergedData: ScreenshotWithSpeechData[]): Promise<string> {
  const videoFile = getBackgroundVideo();

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

  const mergedSpeechFilesPath = "audio.mp3";
  await mergeMp3Files(
    mergedData.map((data) => data.speechFile),
    mergedSpeechFilesPath
  );

  const mp3Duration = getMP3Duration(fs.readFileSync(mergedSpeechFilesPath)) / 1000;
  const mp4Duration = await getVideoDurationInSeconds(join(__dirname, "..", "backgroundvideo", videoFile));

  const startTime = getStartTime(mp3Duration, mp4Duration);
  const video = ffmpeg(join(__dirname, "..", "backgroundvideo", videoFile)).setStartTime(startTime);

  video.addInput(mergedSpeechFilesPath);

  let totalDuration = 0;
  for (const [index, data] of mergedData.entries()) {
    const mp3RoundedDuration = Number((data.duration / 1000).toFixed(3));
    video.addInput(data.screenshot);
    console.log(data.screenshot);

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

  video.setDuration(totalDuration).complexFilter(complexFilter).output(videoFile);

  console.log("Starting video editing...");

  return new Promise((resolve, reject) => {
    video
      .on("end", function (err) {
        if (!err) {
          console.log("Video conversion done");

          resolve(videoFile);
        }
      })
      .on("errors", (err) => {
        reject(err);
      })
      .run();
  });
}

function getStartTime(mp3Duration: number, mp4Duration: number): string {
  const possibleStartTime = mp4Duration - mp3Duration;

  return `${Math.floor(possibleStartTime / 60)}:${possibleStartTime % 60}`;
}

function getBackgroundVideo(): string {
  const backgrounds = fs.readdirSync(join(__dirname, "..", "backgroundvideo"));

  return backgrounds[Math.floor(Math.random() * backgrounds.length)];
}
