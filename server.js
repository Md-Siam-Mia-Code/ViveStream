<<<<<<< HEAD
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const fsPromises = require('fs').promises;
const app = express();
require('dotenv').config();

// Platform configuration
const PLATFORM = process.platform === 'win32' ? 'win' :
     process.platform === 'darwin' ? 'mac' : 'linux';

// FFmpeg paths
const FFMPEG_BIN_PATH = path.join(
     __dirname,
     'dependencies/ffmpeg',
     PLATFORM,
     'bin',
     process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
);

// Create required directories
const requiredDirs = ['database/audio', 'database/video', 'database/cover', 'database/temp', 'appdata'];
requiredDirs.forEach(dir => {
     const dirPath = path.join(__dirname, dir);
     if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use('/audio', express.static(path.join(__dirname, 'database', 'audio')));
app.use('/video', express.static(path.join(__dirname, 'database', 'video')));
app.use('/cover', express.static(path.join(__dirname, 'database', 'cover')));

// Track database
let tracks = [];
const tracksFilePath = path.join(__dirname, 'appdata', 'tracks.json');
try {
     const data = fs.readFileSync(tracksFilePath, 'utf8');
     tracks = JSON.parse(data);
} catch (e) {
     console.log('No existing tracks found');
}

// Helper functions
const sanitizeFilename = (title) => {
     return title.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
};

const isValidYouTubeUrl = (url) => {
     const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
     return pattern.test(url);
};

// SSE Download endpoint
app.get('/download', (req, res) => {
     const url = decodeURIComponent(req.query.url);
     const resolution = req.query.resolution || '144p';

     res.setHeader('Content-Type', 'text/event-stream');
     res.setHeader('Cache-Control', 'no-cache');
     res.setHeader('Connection', 'keep-alive');

     const sendEvent = (type, data) => {
          res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
     };

     const cleanupAndEnd = () => {
          try { res.end(); } catch (e) { /* Connection already closed */ }
     };

     if (!isValidYouTubeUrl(url)) {
          sendEvent('error', { message: 'Invalid YouTube URL' });
          cleanupAndEnd();
          return;
     }

     const processDownload = async () => {
          try {
               const videoData = await processYouTubeUrl(url, resolution, sendEvent);
               tracks.push(videoData);
               await fsPromises.writeFile(tracksFilePath, JSON.stringify(tracks, null, 2));
               sendEvent('complete', videoData);
          } catch (err) {
               sendEvent('error', { message: err.message });
          } finally {
               cleanupAndEnd();
          }
     };

     processDownload().catch(err => {
          console.error('Unhandled error:', err);
          sendEvent('error', { message: 'Internal server error' });
          cleanupAndEnd();
     });
});

// Track list endpoint
app.get('/tracks', (req, res) => res.json(tracks));

// Rename track endpoint
app.post('/rename', async (req, res) => {
     const { id, newTitle } = req.body;
     const track = tracks.find(t => t.id === id);
     if (!track) {
          return res.json({ success: false, message: 'Track not found' });
     }

     const oldSanitizedTitle = sanitizeFilename(track.title);
     const newSanitizedTitle = sanitizeFilename(newTitle);

     const oldAudioPath = path.join(__dirname, 'database', 'audio', `${id}-${oldSanitizedTitle}.mp3`);
     const oldVideoPath = path.join(__dirname, 'database', 'video', `${id}-${oldSanitizedTitle}.mp4`);
     const oldCoverPath = path.join(__dirname, 'database', 'cover', `${id}-${oldSanitizedTitle}.jpg`);

     const newAudioPath = path.join(__dirname, 'database', 'audio', `${id}-${newSanitizedTitle}.mp3`);
     const newVideoPath = path.join(__dirname, 'database', 'video', `${id}-${newSanitizedTitle}.mp4`);
     const newCoverPath = path.join(__dirname, 'database', 'cover', `${id}-${newSanitizedTitle}.jpg`);

     try {
          if (fs.existsSync(oldAudioPath)) await fsPromises.rename(oldAudioPath, newAudioPath);
          if (fs.existsSync(oldVideoPath)) await fsPromises.rename(oldVideoPath, newVideoPath);
          if (fs.existsSync(oldCoverPath)) await fsPromises.rename(oldCoverPath, newCoverPath);

          track.title = newTitle;
          track.audio = `/audio/${id}-${newSanitizedTitle}.mp3`;
          track.video = `/video/${id}-${newSanitizedTitle}.mp4`;
          track.cover = `/cover/${id}-${newSanitizedTitle}.jpg`;

          await fsPromises.writeFile(tracksFilePath, JSON.stringify(tracks, null, 2));
          res.json({ success: true, audioUrl: track.audio, videoUrl: track.video, cover: track.cover });
     } catch (err) {
          console.error('Error renaming track:', err);
          res.json({ success: false, message: 'Failed to rename track' });
     }
});

// Delete track endpoint
app.post('/delete', async (req, res) => {
     const { id } = req.body;
     const trackIndex = tracks.findIndex(t => t.id === id);
     if (trackIndex === -1) {
          return res.json({ success: false, message: 'Track not found' });
     }

     const track = tracks[trackIndex];
     const sanitizedTitle = sanitizeFilename(track.title);

     const audioPath = path.join(__dirname, 'database', 'audio', `${id}-${sanitizedTitle}.mp3`);
     const videoPath = path.join(__dirname, 'database', 'video', `${id}-${sanitizedTitle}.mp4`);
     const coverPath = path.join(__dirname, 'database', 'cover', `${id}-${sanitizedTitle}.jpg`);

     try {
          if (fs.existsSync(audioPath)) await fsPromises.unlink(audioPath);
          if (fs.existsSync(videoPath)) await fsPromises.unlink(videoPath);
          if (fs.existsSync(coverPath)) await fsPromises.unlink(coverPath);

          tracks.splice(trackIndex, 1);
          await fsPromises.writeFile(tracksFilePath, JSON.stringify(tracks, null, 2));
          res.json({ success: true });
     } catch (err) {
          console.error('Error deleting track:', err);
          res.json({ success: false, message: 'Failed to delete track' });
     }
});

async function processYouTubeUrl(url, resolution, sendEvent) {
     const uniqueId = Date.now();
     try {
          sendEvent('progress', { message: 'Starting download...', progress: 0 });

          const title = await extractTitle(url);
          const sanitizedTitle = sanitizeFilename(title);

          const { filePath } = await downloadYouTubeVideo(url, resolution, sendEvent, uniqueId);

          if (!fs.existsSync(filePath)) {
               throw new Error('Downloaded file not found');
          }

          sendEvent('progress', { message: 'Processing audio...', progress: 50 });
          await convertToMP3(sanitizedTitle, filePath, uniqueId);

          sendEvent('progress', { message: 'Extracting thumbnail...', progress: 75 });
          const coverPath = await extractThumbnail(sanitizedTitle, uniqueId, filePath);

          await moveVideoFile(sanitizedTitle, uniqueId, filePath);
          await cleanTempFiles(uniqueId);

          sendEvent('progress', { message: 'Finalizing...', progress: 100 });

          return {
               id: uniqueId,
               title,
               audio: `/audio/${uniqueId}-${sanitizedTitle}.mp3`,
               video: `/video/${uniqueId}-${sanitizedTitle}.mp4`,
               cover: `/cover/${uniqueId}-${sanitizedTitle}.jpg`,
               date: new Date().toISOString()
          };
     } catch (err) {
          await cleanTempFiles(uniqueId);
          throw err;
     }
}

async function extractTitle(url) {
     return new Promise((resolve, reject) => {
          const yt = spawn('yt-dlp', ['--get-title', url]);

          let title = '';
          yt.stdout.on('data', (data) => {
               title += data.toString().trim();
          });

          yt.stderr.on('data', (data) => {
               console.error(`yt-dlp stderr: ${data}`);
          });

          yt.on('close', (code) => {
               if (code !== 0) reject(new Error('Failed to extract title'));
               else resolve(title);
          });

          yt.on('error', (err) => {
               reject(new Error('yt-dlp execution failed'));
          });
     });
}

async function downloadYouTubeVideo(url, resolution, sendEvent, uniqueId) {
     return new Promise((resolve, reject) => {
          const args = [
               '-o', `database/temp/${uniqueId}.%(ext)s`,
               '--restrict-filenames',
               '--ffmpeg-location', FFMPEG_BIN_PATH,
               '-f', `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`,
               '--merge-output-format', 'mp4',
               url
          ];

          const yt = spawn('yt-dlp', args);

          let stdoutData = '';
          let stderrData = '';

          yt.stdout.on('data', (data) => {
               const output = data.toString().trim();
               stdoutData += output;
               console.log(`yt-dlp stdout: ${output}`);

               const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%/);
               if (progressMatch) {
                    sendEvent('progress', {
                         message: `Downloading (${progressMatch[1]}%)`,
                         progress: parseFloat(progressMatch[1])
                    });
               }
          });

          yt.stderr.on('data', (data) => {
               stderrData += data.toString();
               console.error(`yt-dlp stderr: ${data}`);
          });

          yt.on('close', (code) => {
               if (code !== 0) {
                    console.error(`yt-dlp exited with code ${code}: ${stderrData}`);
                    return reject(new Error('Download failed'));
               }

               const videoFile = `${uniqueId}.mp4`;
               const finalPath = path.join(__dirname, 'database', 'temp', videoFile);

               if (!fs.existsSync(finalPath)) {
                    return reject(new Error('Downloaded file not found'));
               }

               resolve({ filePath: finalPath });
          });

          yt.on('error', (err) => {
               console.error('yt-dlp error:', err.message);
               reject(new Error('yt-dlp execution failed'));
          });
     });
}

async function convertToMP3(sanitizedTitle, videoPath, uniqueId) {
     return new Promise((resolve, reject) => {
          const outputPath = path.join(__dirname, 'database', 'audio', `${uniqueId}-${sanitizedTitle}.mp3`);
          const args = [
               '-i', videoPath,
               '-vn',
               '-acodec', 'libmp3lame',
               '-q:a', '2',
               outputPath
          ];

          const ffmpeg = spawn(FFMPEG_BIN_PATH, args);

          ffmpeg.stderr.on('data', (data) => {
               const errorMessage = data.toString();
               if (!errorMessage.includes('size=') && !errorMessage.includes('Output #0')) {
                    console.error('FFmpeg error:', errorMessage);
               }
          });

          ffmpeg.on('close', (code) => {
               if (code !== 0) reject(new Error('Audio conversion failed'));
               else resolve();
          });
     });
}

async function extractThumbnail(sanitizedTitle, uniqueId, videoPath) {
     return new Promise((resolve, reject) => {
          const thumbnailPath = path.join(__dirname, 'database', 'cover', `${uniqueId}-${sanitizedTitle}.jpg`);

          const ffmpeg = spawn(FFMPEG_BIN_PATH, [
               '-i', videoPath,
               '-ss', '00:00:01.000',
               '-vframes', '1',
               thumbnailPath
          ]);

          ffmpeg.on('close', (code) => {
               if (code !== 0) reject(new Error('Thumbnail extraction failed'));
               else resolve(`/cover/${uniqueId}-${sanitizedTitle}.jpg`);
          });
     });
}

async function moveVideoFile(sanitizedTitle, uniqueId, oldPath) {
     const newVideoPath = path.join(__dirname, 'database', 'video', `${uniqueId}-${sanitizedTitle}.mp4`);
     await fsPromises.rename(oldPath, newVideoPath);
     console.log(`Video file moved to: ${newVideoPath}`);
}

async function cleanTempFiles(uniqueId) {
     try {
          const tempDir = await fsPromises.readdir(path.join(__dirname, 'database', 'temp'));
          await Promise.all(
               tempDir
                    .filter(file => file.startsWith(uniqueId.toString()))
                    .map(file => fsPromises.unlink(path.join(__dirname, 'database', 'temp', file)))
          );
     } catch (err) {
          console.error('Cleanup error:', err.message);
     }
}

app.listen(process.env.PORT || 3015, () => {
     console.log(`Server running on port ${process.env.PORT || 3015}`);
     console.log('FFmpeg path:', FFMPEG_BIN_PATH);
     console.log('FFmpeg exists:', fs.existsSync(FFMPEG_BIN_PATH));
=======
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const fsPromises = require('fs').promises;
const app = express();
require('dotenv').config();

// Platform configuration
const PLATFORM = process.platform === 'win32' ? 'win' :
     process.platform === 'darwin' ? 'mac' : 'linux';

// FFmpeg paths
const FFMPEG_BIN_PATH = path.join(
     __dirname,
     'dependencies/ffmpeg',
     PLATFORM,
     'bin',
     process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
);

// Create required directories
const requiredDirs = ['database/audio', 'database/video', 'database/cover', 'database/temp', 'appdata'];
requiredDirs.forEach(dir => {
     const dirPath = path.join(__dirname, dir);
     if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use('/audio', express.static(path.join(__dirname, 'database', 'audio')));
app.use('/video', express.static(path.join(__dirname, 'database', 'video')));
app.use('/cover', express.static(path.join(__dirname, 'database', 'cover')));

// Track database
let tracks = [];
const tracksFilePath = path.join(__dirname, 'appdata', 'tracks.json');
try {
     const data = fs.readFileSync(tracksFilePath, 'utf8');
     tracks = JSON.parse(data);
} catch (e) {
     console.log('No existing tracks found');
}

// Helper functions
const sanitizeFilename = (title) => {
     return title.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
};

const isValidYouTubeUrl = (url) => {
     const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
     return pattern.test(url);
};

// SSE Download endpoint
app.get('/download', (req, res) => {
     const url = decodeURIComponent(req.query.url);
     const resolution = req.query.resolution || '144p';

     res.setHeader('Content-Type', 'text/event-stream');
     res.setHeader('Cache-Control', 'no-cache');
     res.setHeader('Connection', 'keep-alive');

     const sendEvent = (type, data) => {
          res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
     };

     const cleanupAndEnd = () => {
          try { res.end(); } catch (e) { /* Connection already closed */ }
     };

     if (!isValidYouTubeUrl(url)) {
          sendEvent('error', { message: 'Invalid YouTube URL' });
          cleanupAndEnd();
          return;
     }

     const processDownload = async () => {
          try {
               const videoData = await processYouTubeUrl(url, resolution, sendEvent);
               tracks.push(videoData);
               await fsPromises.writeFile(tracksFilePath, JSON.stringify(tracks, null, 2));
               sendEvent('complete', videoData);
          } catch (err) {
               sendEvent('error', { message: err.message });
          } finally {
               cleanupAndEnd();
          }
     };

     processDownload().catch(err => {
          console.error('Unhandled error:', err);
          sendEvent('error', { message: 'Internal server error' });
          cleanupAndEnd();
     });
});

// Track list endpoint
app.get('/tracks', (req, res) => res.json(tracks));

// Rename track endpoint
app.post('/rename', async (req, res) => {
     const { id, newTitle } = req.body;
     const track = tracks.find(t => t.id === id);
     if (!track) {
          return res.json({ success: false, message: 'Track not found' });
     }

     const oldSanitizedTitle = sanitizeFilename(track.title);
     const newSanitizedTitle = sanitizeFilename(newTitle);

     const oldAudioPath = path.join(__dirname, 'database', 'audio', `${id}-${oldSanitizedTitle}.mp3`);
     const oldVideoPath = path.join(__dirname, 'database', 'video', `${id}-${oldSanitizedTitle}.mp4`);
     const oldCoverPath = path.join(__dirname, 'database', 'cover', `${id}-${oldSanitizedTitle}.jpg`);

     const newAudioPath = path.join(__dirname, 'database', 'audio', `${id}-${newSanitizedTitle}.mp3`);
     const newVideoPath = path.join(__dirname, 'database', 'video', `${id}-${newSanitizedTitle}.mp4`);
     const newCoverPath = path.join(__dirname, 'database', 'cover', `${id}-${newSanitizedTitle}.jpg`);

     try {
          if (fs.existsSync(oldAudioPath)) await fsPromises.rename(oldAudioPath, newAudioPath);
          if (fs.existsSync(oldVideoPath)) await fsPromises.rename(oldVideoPath, newVideoPath);
          if (fs.existsSync(oldCoverPath)) await fsPromises.rename(oldCoverPath, newCoverPath);

          track.title = newTitle;
          track.audio = `/audio/${id}-${newSanitizedTitle}.mp3`;
          track.video = `/video/${id}-${newSanitizedTitle}.mp4`;
          track.cover = `/cover/${id}-${newSanitizedTitle}.jpg`;

          await fsPromises.writeFile(tracksFilePath, JSON.stringify(tracks, null, 2));
          res.json({ success: true, audioUrl: track.audio, videoUrl: track.video, cover: track.cover });
     } catch (err) {
          console.error('Error renaming track:', err);
          res.json({ success: false, message: 'Failed to rename track' });
     }
});

// Delete track endpoint
app.post('/delete', async (req, res) => {
     const { id } = req.body;
     const trackIndex = tracks.findIndex(t => t.id === id);
     if (trackIndex === -1) {
          return res.json({ success: false, message: 'Track not found' });
     }

     const track = tracks[trackIndex];
     const sanitizedTitle = sanitizeFilename(track.title);

     const audioPath = path.join(__dirname, 'database', 'audio', `${id}-${sanitizedTitle}.mp3`);
     const videoPath = path.join(__dirname, 'database', 'video', `${id}-${sanitizedTitle}.mp4`);
     const coverPath = path.join(__dirname, 'database', 'cover', `${id}-${sanitizedTitle}.jpg`);

     try {
          if (fs.existsSync(audioPath)) await fsPromises.unlink(audioPath);
          if (fs.existsSync(videoPath)) await fsPromises.unlink(videoPath);
          if (fs.existsSync(coverPath)) await fsPromises.unlink(coverPath);

          tracks.splice(trackIndex, 1);
          await fsPromises.writeFile(tracksFilePath, JSON.stringify(tracks, null, 2));
          res.json({ success: true });
     } catch (err) {
          console.error('Error deleting track:', err);
          res.json({ success: false, message: 'Failed to delete track' });
     }
});

async function processYouTubeUrl(url, resolution, sendEvent) {
     const uniqueId = Date.now();
     try {
          sendEvent('progress', { message: 'Starting download...', progress: 0 });

          const title = await extractTitle(url);
          const sanitizedTitle = sanitizeFilename(title);

          const { filePath } = await downloadYouTubeVideo(url, resolution, sendEvent, uniqueId);

          if (!fs.existsSync(filePath)) {
               throw new Error('Downloaded file not found');
          }

          sendEvent('progress', { message: 'Processing audio...', progress: 50 });
          await convertToMP3(sanitizedTitle, filePath, uniqueId);

          sendEvent('progress', { message: 'Extracting thumbnail...', progress: 75 });
          const coverPath = await extractThumbnail(sanitizedTitle, uniqueId, filePath);

          await moveVideoFile(sanitizedTitle, uniqueId, filePath);
          await cleanTempFiles(uniqueId);

          sendEvent('progress', { message: 'Finalizing...', progress: 100 });

          return {
               id: uniqueId,
               title,
               audio: `/audio/${uniqueId}-${sanitizedTitle}.mp3`,
               video: `/video/${uniqueId}-${sanitizedTitle}.mp4`,
               cover: `/cover/${uniqueId}-${sanitizedTitle}.jpg`,
               date: new Date().toISOString()
          };
     } catch (err) {
          await cleanTempFiles(uniqueId);
          throw err;
     }
}

async function extractTitle(url) {
     return new Promise((resolve, reject) => {
          const yt = spawn('yt-dlp', ['--get-title', url]);

          let title = '';
          yt.stdout.on('data', (data) => {
               title += data.toString().trim();
          });

          yt.stderr.on('data', (data) => {
               console.error(`yt-dlp stderr: ${data}`);
          });

          yt.on('close', (code) => {
               if (code !== 0) reject(new Error('Failed to extract title'));
               else resolve(title);
          });

          yt.on('error', (err) => {
               reject(new Error('yt-dlp execution failed'));
          });
     });
}

async function downloadYouTubeVideo(url, resolution, sendEvent, uniqueId) {
     return new Promise((resolve, reject) => {
          const args = [
               '-o', `database/temp/${uniqueId}.%(ext)s`,
               '--restrict-filenames',
               '--ffmpeg-location', FFMPEG_BIN_PATH,
               '-f', `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`,
               '--merge-output-format', 'mp4',
               url
          ];

          const yt = spawn('yt-dlp', args);

          let stdoutData = '';
          let stderrData = '';

          yt.stdout.on('data', (data) => {
               const output = data.toString().trim();
               stdoutData += output;
               console.log(`yt-dlp stdout: ${output}`);

               const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%/);
               if (progressMatch) {
                    sendEvent('progress', {
                         message: `Downloading (${progressMatch[1]}%)`,
                         progress: parseFloat(progressMatch[1])
                    });
               }
          });

          yt.stderr.on('data', (data) => {
               stderrData += data.toString();
               console.error(`yt-dlp stderr: ${data}`);
          });

          yt.on('close', (code) => {
               if (code !== 0) {
                    console.error(`yt-dlp exited with code ${code}: ${stderrData}`);
                    return reject(new Error('Download failed'));
               }

               const videoFile = `${uniqueId}.mp4`;
               const finalPath = path.join(__dirname, 'database', 'temp', videoFile);

               if (!fs.existsSync(finalPath)) {
                    return reject(new Error('Downloaded file not found'));
               }

               resolve({ filePath: finalPath });
          });

          yt.on('error', (err) => {
               console.error('yt-dlp error:', err.message);
               reject(new Error('yt-dlp execution failed'));
          });
     });
}

async function convertToMP3(sanitizedTitle, videoPath, uniqueId) {
     return new Promise((resolve, reject) => {
          const outputPath = path.join(__dirname, 'database', 'audio', `${uniqueId}-${sanitizedTitle}.mp3`);
          const args = [
               '-i', videoPath,
               '-vn',
               '-acodec', 'libmp3lame',
               '-q:a', '2',
               outputPath
          ];

          const ffmpeg = spawn(FFMPEG_BIN_PATH, args);

          ffmpeg.stderr.on('data', (data) => {
               const errorMessage = data.toString();
               if (!errorMessage.includes('size=') && !errorMessage.includes('Output #0')) {
                    console.error('FFmpeg error:', errorMessage);
               }
          });

          ffmpeg.on('close', (code) => {
               if (code !== 0) reject(new Error('Audio conversion failed'));
               else resolve();
          });
     });
}

async function extractThumbnail(sanitizedTitle, uniqueId, videoPath) {
     return new Promise((resolve, reject) => {
          const thumbnailPath = path.join(__dirname, 'database', 'cover', `${uniqueId}-${sanitizedTitle}.jpg`);

          const ffmpeg = spawn(FFMPEG_BIN_PATH, [
               '-i', videoPath,
               '-ss', '00:00:01.000',
               '-vframes', '1',
               thumbnailPath
          ]);

          ffmpeg.on('close', (code) => {
               if (code !== 0) reject(new Error('Thumbnail extraction failed'));
               else resolve(`/cover/${uniqueId}-${sanitizedTitle}.jpg`);
          });
     });
}

async function moveVideoFile(sanitizedTitle, uniqueId, oldPath) {
     const newVideoPath = path.join(__dirname, 'database', 'video', `${uniqueId}-${sanitizedTitle}.mp4`);
     await fsPromises.rename(oldPath, newVideoPath);
     console.log(`Video file moved to: ${newVideoPath}`);
}

async function cleanTempFiles(uniqueId) {
     try {
          const tempDir = await fsPromises.readdir(path.join(__dirname, 'database', 'temp'));
          await Promise.all(
               tempDir
                    .filter(file => file.startsWith(uniqueId.toString()))
                    .map(file => fsPromises.unlink(path.join(__dirname, 'database', 'temp', file)))
          );
     } catch (err) {
          console.error('Cleanup error:', err.message);
     }
}

app.listen(process.env.PORT || 3015, () => {
     console.log(`Server running on port ${process.env.PORT || 3015}`);
     console.log('FFmpeg path:', FFMPEG_BIN_PATH);
     console.log('FFmpeg exists:', fs.existsSync(FFMPEG_BIN_PATH));
>>>>>>> db13efa (Your Vives are UP!!!)
});