/**
 * Sentinel Unified Grid — Screen Demo Video Recorder (P0 Item 5)
 * Captures high-definition screen recordings directly from the browser
 * with one-click download for hackathon submission evidence.
 */

export class ScreenDemoRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.timerInterval = null;
    this.recordingSeconds = 0;
    
    this.btn = document.getElementById('btn-screen-record');
    this.btnText = document.getElementById('record-btn-text');
    this.recDot = document.getElementById('rec-dot-icon');
  }

  init() {
    if (!this.btn) return;
    this.btn.addEventListener('click', () => this.toggleRecording());
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      // Prompt user to select screen/window/tab with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          frameRate: { ideal: 30, max: 60 }
        },
        audio: true
      });

      this.recordedChunks = [];
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      
      // Fallback mime types if vp9 is unsupported
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.saveRecording();
        this.cleanup();
      };

      // Stop recording automatically if user stops screen share via native browser bar
      stream.getVideoTracks()[0].onended = () => {
        if (this.isRecording) {
          this.stopRecording();
        }
      };

      this.mediaRecorder.start(1000); // 1-second chunks
      this.isRecording = true;
      this.recordingSeconds = 0;

      // Update UI
      if (this.btn) {
        this.btn.style.background = 'rgba(239, 68, 68, 0.4)';
        this.btn.style.borderColor = '#ef4444';
      }
      if (this.recDot) {
        this.recDot.style.animation = 'pulseBeacon 0.8s infinite';
      }

      this.timerInterval = setInterval(() => {
        this.recordingSeconds++;
        const mins = String(Math.floor(this.recordingSeconds / 60)).padStart(2, '0');
        const secs = String(this.recordingSeconds % 60).padStart(2, '0');
        if (this.btnText) {
          this.btnText.textContent = `REC ${mins}:${secs} (STOP)`;
        }
      }, 1000);

      console.log("[REC] Screen recording started successfully.");
    } catch (err) {
      console.warn("[REC] Recording permission denied or cancelled:", err);
      alert("Screen recording was not started: " + (err.message || "User cancelled capture"));
    }
  }

  stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;
    this.mediaRecorder.stop();
    // Stop all media tracks
    if (this.mediaRecorder.stream) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    this.cleanup();
  }

  cleanup() {
    this.isRecording = false;
    clearInterval(this.timerInterval);
    this.recordingSeconds = 0;

    if (this.btn) {
      this.btn.style.background = 'rgba(239, 68, 68, 0.15)';
      this.btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    }
    if (this.recDot) {
      this.recDot.style.animation = 'none';
    }
    if (this.btnText) {
      this.btnText.textContent = "Record Demo Video";
    }
  }

  saveRecording() {
    if (this.recordedChunks.length === 0) return;

    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `Sentinel_Unified_Grid_Demo_${timestamp}.webm`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    alert(`✅ Screen Demo Recording Saved!\nFilename: Sentinel_Unified_Grid_Demo_${timestamp}.webm\nReady for hackathon submission.`);
  }
}
