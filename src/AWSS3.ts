import {
  S3Client,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ObjectIdentifier,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";
import { join } from "path";
import { Readable } from "stream";
dotenv.config();

const client = new S3Client({
  region: "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
});

export async function saveSpeechFiles(objectsKey: string[], savePath: string) {
  console.log("objects to fetch:", objectsKey);

  for (const key of objectsKey) {
    const command = new GetObjectCommand({
      Key: key,
      Bucket: process.env.AWS_BUCKETNAME as string,
    });

    const response = await client.send(command);

    await new Promise((resolve, reject) => {
      if (response.Body && response.Body instanceof Readable) {
        response.Body.pipe(fs.createWriteStream(join(savePath, key)))
          .on("error", (err) => reject(err))
          .on("close", () => {
            resolve(true);
          });
      }
    });
  }
}
//może pojedynczo jednak trzeba?
export async function deleteObjects(objects: ObjectIdentifier[]) {
  const command = new DeleteObjectsCommand({
    Delete: {
      Objects: objects,
    },
    Bucket: process.env.AWS_BUCKETNAME as string,
  });

  const res = await client.send(command);
  console.log(res);
  console.log(`Deleted ${objects.length} objects`);
}

export async function getObjectsListing() {
  const listing = new ListObjectsV2Command({
    Prefix: "reddit",
    Bucket: process.env.AWS_BUCKETNAME as string,
  });

  const response = await client.send(listing);
  return response.Contents;
}
