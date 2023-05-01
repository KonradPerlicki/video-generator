import ffmpeg, { FilterSpecification } from "fluent-ffmpeg";
import { join } from "path";
import Screenshoter from "./Screenshoter";

export async function editVideo(videoFile: string, screenshots: string[]) {
  const complexFilter: Array<FilterSpecification> = [
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
  const video = ffmpeg(join(__dirname, "..", "backgroundvideo", videoFile))
    .setStartTime("00:00:01")
    .setDuration("8");

  for (const [index, screenshot] of screenshots.entries()) {
    video.addInput(screenshot);
    const filter: FilterSpecification = {
      filter: "overlay",
      inputs: index === 0 ? "blurred" : `overlay${index - 1}`,
      options: {
        enable: `between(t,${index + 1},${(index + 1) * 2})`, //TODO array needs to contain displaying image time
      },
      outputs: `overlay${index}`,
    };

    //last filter must be without output property
    if (index === screenshots.length - 1) {
      delete filter.outputs;
    }

    complexFilter.push(filter);
  }

  video
    .complexFilter(complexFilter)
    .output("video_out.mp4")
    .on("end", async function (err) {
      if (!err) {
        console.log("Video conversion done");
        await Screenshoter.removeScreenshots();
        //TODO upload video logic here
      }
    })
    .on("errors", (err) => console.log("error: ", err))
    .run();
}
