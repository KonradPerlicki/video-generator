# About this script
This script creates videos in a popular TikTok and YouTube shorts format with spoken story/some text and relaxing video in the background.  
It receives daily trending post from selected Reddit subreddit, sends post's content to AWS Polly which turns text into speech and save in AWS S3, headless chrome 
opens the page and takes multiple screenshots of title and body of the post.  
Then, FFmpeg combines those screenshots, some pre-downloaded background videos and speech files in .mp3 format into one .mp4 file.  
Eventually, the file is being uploaded to my YouTube channel which is available here: 
[Reddit Trending Stories](https://www.youtube.com/channel/UCahPMNpxIxDuNrvcoZV6BAw)
