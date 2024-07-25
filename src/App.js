import React, { useState, useRef, useEffect } from 'react';
import { Button, Container, Typography, Box } from '@mui/material';
import WaveSurfer from 'wavesurfer.js';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import toWav from 'audiobuffer-to-wav';

const App = () => {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const wavesurferRef = useRef(null);
  const recorder = useRef(null);

  useEffect(() => {
    wavesurferRef.current = WaveSurfer.create({
      container: '#waveform',
      waveColor: 'violet',
      progressColor: 'purple',
      cursorColor: 'navy',
      barWidth: 3,
      responsive: true,
      height: 200,
      normalize: true,
    });

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, []);

  const startRecording = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Your browser does not support audio recording');
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      recorder.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: StereoAudioRecorder,
        desiredSampRate: 16000, // Set the sample rate to 16 kHz
      });

      recorder.current.startRecording();
      setIsRecording(true);
      wavesurferRef.current.empty();
      toast.info('Recording started');
    }).catch((e) => {
      console.error(e);
      toast.error('Failed to start recording');
    });
  };

  const stopRecording = () => {
    recorder.current.stopRecording(async () => {
      const originalBlob = recorder.current.getBlob();
      
      // Convert to 16 kHz if necessary
      const convertedBlob = await convertTo16kHz(originalBlob);

      const url = URL.createObjectURL(convertedBlob);

      setAudioBlob(convertedBlob);
      setAudioUrl(url);
      wavesurferRef.current.load(url);

      setIsRecording(false);
      toast.success('Recording stopped. File type: audio/wav');

      // Verify sample rate
      verifySampleRate(convertedBlob);
    });
  };

  const convertTo16kHz = async (audioBlob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create a new audio buffer with the desired sample rate
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length * (16000 / audioBuffer.sampleRate),
        16000
      );

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);

      const newBuffer = await offlineContext.startRendering();

      // Convert to WAV
      const wav = toWav(newBuffer);
      const newBlob = new Blob([wav], { type: 'audio/wav' });

      return newBlob;
    } catch (error) {
      console.error('Error converting audio to 16 kHz:', error);
      toast.error('Error converting audio to 16 kHz');
      return audioBlob; // Return the original blob if conversion fails
    }
  };

  const verifySampleRate = async (audioBlob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      console.log(`Sample Rate: ${audioBuffer.sampleRate}`);
    } catch (error) {
      console.error('Error verifying sample rate:', error);
    }
  };

  const handleTranscription = async () => {
    if (!audioBlob) {
      console.error('No audio recorded yet.');
      toast.error('No audio recorded yet.');
      return;
    }

    setIsTranscribing(true);

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('temperature', '0.0');
    formData.append('temperature_inc', '0.2');
    formData.append('response_format', 'json');

    try {
      toast.info('Transcribing...');
      const response = await fetch('http://82.217.100.245:8080/inference', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();

      console.log(`Response: ${JSON.stringify(data, null, 2)}\n`);

      if (data.error) {
        setTranscript(`Error: ${data.error}`);
        toast.error('Transcription failed');
      } else if (data.text) {
        setTranscript(data.text);
        toast.success('Transcription completed');
      } else {
        setTranscript('Unexpected response format');
        toast.info('Transcription completed but unexpected response format');
      }
    } catch (error) {
      console.error('Failed to fetch transcription:', error);
      toast.error('Failed to fetch transcription');
    } finally {
      setIsTranscribing(false);
    }
  };

  const playAudio = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  return (
    <Container>
      <ToastContainer />
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          textAlign: 'center' 
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Real-Time Speech Recognition
        </Typography>
        <div id="waveform" style={{ width: '100%', maxWidth: '600px' }}></div>
        <Box sx={{ my: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={startRecording}
            disabled={isRecording}
            sx={{ mx: 1 }}
          >
            Start Recording
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={stopRecording}
            disabled={!isRecording}
            sx={{ mx: 1 }}
          >
            Stop Recording
          </Button>
        </Box>
        {audioUrl && (
          <Box sx={{ my: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={playAudio}
              sx={{ mx: 1 }}
            >
              Play / Pause Audio
            </Button>
          </Box>
        )}
        <Box sx={{ my: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleTranscription}
            disabled={isTranscribing}
            sx={{ mx: 1 }}
          >
            {isTranscribing ? 'Transcribing...' : 'Transcribe'}
          </Button>
        </Box>
        <Typography variant="h6">Transcript:</Typography>
        <Typography>{transcript || 'No transcription available'}</Typography>
      </Box>
    </Container>
  );
};

export default App;
