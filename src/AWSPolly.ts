import {
  PollyClient,
  StartSpeechSynthesisTaskCommand,
  ListSpeechSynthesisTasksCommand,
} from "@aws-sdk/client-polly";
import dotenv from "dotenv";
dotenv.config();

export default async function getCompletedSpeechObjectsList(texts: string[]): Promise<null | string[]> {
  const client = new PollyClient({
    region: "eu-west-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY as string,
      secretAccessKey: process.env.AWS_SECRET_KEY as string,
    },
  });

  const filesNames: string[] = [];

  for (const text of texts) {
    const command = new StartSpeechSynthesisTaskCommand({
      Engine: "standard",
      LanguageCode: "en-US",
      OutputFormat: "mp3",
      OutputS3BucketName: process.env.AWS_BUCKETNAME as string,
      OutputS3KeyPrefix: "reddit",
      Text: text,
      TextType: "text",
      VoiceId: "Matthew",
    });

    const response = await client.send(command);

    if (
      response.$metadata.httpStatusCode !== 200 ||
      !response.SynthesisTask ||
      !response.SynthesisTask.OutputUri
    ) {
      throw new Error("Error sending speech request command");
    } else {
      filesNames.push(response.SynthesisTask.OutputUri.split("/").pop()!);
    }
  }

  //waiting for speech files to show up in s3 bucket
  return new Promise((resolve) => {
    let maxRetries = 10;

    const interval = setInterval(async () => {
      maxRetries--;

      if (maxRetries === 0) {
        clearInterval(interval);
        return resolve(null);
      }

      const listing = new ListSpeechSynthesisTasksCommand({
        Status: "completed",
      });
      const response = await client.send(listing);

      if (response.SynthesisTasks && response.SynthesisTasks.length === filesNames.length) {
        clearInterval(interval);
        return resolve(filesNames);
      }
    }, 7000);
  });
}
