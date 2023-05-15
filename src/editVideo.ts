import ffmpeg, { FilterSpecification } from "fluent-ffmpeg";
import { join } from "path";
import mergeMp3Files from "./mergeMp3Files";
import Screenshoter from "./Screenshoter";
import fs from "fs";
import kfs from "key-file-storage";
import getMP3Duration from "get-mp3-duration";
const db = kfs(join(__dirname, "..", "db"));
import { getVideoDurationInSeconds } from "get-video-duration";

export interface ScreenshotWithSpeechFile {
  screenshot: string;
  speechFile: string;
  duration: number;
}

interface LastVideo {
  file: string;
  index: number;
}

export async function editVideo(mergedData: ScreenshotWithSpeechFile[]): Promise<string> {
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

  const video = ffmpeg(join(__dirname, "..", "backgroundvideo", videoFile));

  const mergedSpeechFilesPath = "audio.mp3";
  await mergeMp3Files(
    mergedData.map((data) => data.speechFile),
    mergedSpeechFilesPath
  );

  const mp3Duration = getMP3Duration(fs.readFileSync(mergedSpeechFilesPath));
  const mp4Duration = await getVideoDurationInSeconds(join(__dirname, "..", "backgroundvideo", videoFile));
  const isMp3LongerThanMp4 =
    (db.videos_last_duration[videoFile].lastDuration + mp3Duration) * 1000 > mp4Duration;

  const startTime = isMp3LongerThanMp4
    ? new Date(0)
    : new Date(db.videos_last_duration[videoFile].lastDuration);

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

  const outputFilePath = videoFile;

  video
    .setStartTime(startTime.toISOString().slice(11, 19))
    .setDuration(totalDuration)
    .complexFilter(complexFilter)
    .output(outputFilePath);

  console.log("Starting video editing...");

  return new Promise((resolve, reject) => {
    video
      .on("end", function (err) {
        if (!err) {
          console.log("Video conversion done");

          //runs in background
          Screenshoter.removeScreenshots();

          db.videos_last_duration[videoFile].lastDuration = new Date(
            startTime.getTime() + mp3Duration
          ).getTime();

          resolve(outputFilePath);
        }
      })
      .on("errors", (err) => {
        reject(err);
      })
      .run();
  });
}

function getBackgroundVideo() {
  const backgrounds = fs.readdirSync(join(__dirname, "..", "backgroundvideo"));
  const lastVideo: LastVideo = db.last_video;

  if (lastVideo.index === backgrounds.length - 1) {
    db.last_video = {
      file: backgrounds[0],
      index: 0,
    };
    return backgrounds[0];
  } else {
    db.last_video = {
      file: backgrounds[lastVideo.index + 1],
      index: lastVideo.index + 1,
    };
    return backgrounds[lastVideo.index + 1];
  }
}
