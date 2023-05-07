import audioconcat from "audioconcat";

export default async function mergeMp3Files(files: string[], output: string) {
  return new Promise((resolve, reject) => {
    audioconcat(files)
      .concat(output)
      .on("end", function (err) {
        if (!err) {
          console.log(`${files.length} files merged successfully and saved to ${output}`);
          resolve(output);
        } else reject(err);
      })
      .on("errors", (err) => reject(err));
  });
}
