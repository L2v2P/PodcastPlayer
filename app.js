const express = require('express');
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const wav = require('node-wav');

const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/search', async (req, res) => {
  try {
    const searchTerm = req.query.term;
    const response = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=podcast`);
    res.json(response.data);
  } catch (error) {
    console.error('Fout bij het zoeken:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het zoeken' });
  }
});

app.get('/podcast/:id', async (req, res) => {
  try {
    const podcastId = req.params.id;
    const response = await axios.get(`https://itunes.apple.com/lookup?id=${podcastId}&entity=podcastEpisode`);
    res.json(response.data);
  } catch (error) {
    console.error('Fout bij het ophalen van podcastdetails:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van podcastdetails' });
  }
});

app.get('/transcript', async (req, res) => {
  const audioUrl = req.query.url;
  if (!audioUrl) {
    return res.status(400).json({ error: 'Audio URL is vereist' });
  }

  try {
    // Download de audio file
    const audioResponse = await axios({
      method: 'get',
      url: audioUrl,
      responseType: 'stream'
    });

    // Sla de audio tijdelijk op
    const tempAudioPath = './temp_audio.mp3';
    const writer = fs.createWriteStream(tempAudioPath);
    audioResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Converteer MP3 naar WAV
    const tempWavPath = './temp_audio.wav';
    await new Promise((resolve, reject) => {
      ffmpeg(tempAudioPath)
        .toFormat('wav')
        .on('error', reject)
        .on('end', resolve)
        .save(tempWavPath);
    });

    // Lees de WAV file
    const buffer = fs.readFileSync(tempWavPath);
    const result = wav.decode(buffer);

    // Eenvoudige "spraakherkenning" (detecteert alleen stiltes)
    const transcript = detectSpeech(result.channelData[0]);

    // Verwijder tijdelijke bestanden
    fs.unlinkSync(tempAudioPath);
    fs.unlinkSync(tempWavPath);

    res.json({ transcript });
  } catch (error) {
    console.error('Fout bij het genereren van transcript:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het genereren van het transcript' });
  }
});

function detectSpeech(audioData) {
  const threshold = 0.1;
  let isSpeaking = false;
  let speechSegments = [];
  let currentSegment = '';

  for (let i = 0; i < audioData.length; i++) {
    if (Math.abs(audioData[i]) > threshold) {
      if (!isSpeaking) {
        isSpeaking = true;
        currentSegment = 'Spraak ';
      }
    } else {
      if (isSpeaking) {
        isSpeaking = false;
        currentSegment += `(${(i / 44100).toFixed(2)}s) `;
        speechSegments.push(currentSegment);
      }
    }
  }

  return speechSegments.join('\n');
}

app.listen(port, () => {
  console.log(`Podcastplayer app draait op http://localhost:${port}`);
});