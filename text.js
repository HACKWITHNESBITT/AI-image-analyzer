// text.js
// Combined logic: camera features + Matrix background + AI results reveal animation
// Assumes the HTML IDs in index.html

/* ------------------ MATRIX RAIN EFFECT ------------------ */
(function initMatrix() {
    const canvas = document.getElementById('matrixCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const fontSize = 14;
    let columns = Math.floor(W / fontSize);
    const letters = '01⚑✦✧';
    let drops = new Array(columns).fill(1);

    function draw() {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#00ff66';
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = letters[Math.floor(Math.random() * letters.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > H && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    let matrixInterval = setInterval(draw, 45);

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        columns = Math.floor(W / fontSize);
        drops = new Array(columns).fill(1);
    }

    window.addEventListener('resize', resize, { passive: true });

    window._matrixControl = {
        pause: () => clearInterval(matrixInterval),
        resume: () => { matrixInterval = setInterval(draw, 45); }
    };
})();

/* ------------------ CAMERA + APP LOGIC ------------------ */
const cameraFeed = document.getElementById('cameraFeed');
const snapshotCanvas = document.getElementById('snapshotCanvas');
const timestampOverlay = document.getElementById('timestampOverlay');
const countdownDisplay = document.getElementById('countdownDisplay');
const snapshotBtn = document.getElementById('snapshotBtn');
const recordBtn = document.getElementById('recordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const flashToggle = document.getElementById('flashToggle');
const audioToggle = document.getElementById('audioToggle');
const resolutionSelect = document.getElementById('resolutionSelect');
const filterBtns = document.querySelectorAll('.filterBtn');
const aiResults = document.getElementById('aiResults');
const objectsList = document.getElementById('objectsList');
const labelsList = document.getElementById('labelsList');
const cameraContainer = document.getElementById('cameraContainer');

let stream = null;
let videoTrack = null;
let audioTrack = null;
let drawRaf = null;
let audioContext = null;
let currentFilter = 'none';
let zoomLevel = 1;
let supportsZoom = false;
let useHardwareTorch = false;
let isCountingDown = false;
let countdownInterval = null;

const ctx = snapshotCanvas.getContext ? snapshotCanvas.getContext('2d') : null;
const RECORD_FPS = 30;

/* ---------- audio helpers ---------- */
function ensureAudioContext(){
    if (audioContext) return;
    try{ audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ audioContext = null; }
}
function playSound(freq=440, duration=160){
    if (!audioContext || !audioToggle.checked) return;
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.connect(g); g.connect(audioContext.destination);
    o.frequency.value = freq; o.type = 'sine';
    const now = audioContext.currentTime;
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration/1000);
    o.start(now); o.stop(now + duration/1000 + 0.02);
}

/* ---------- timestamp UI ---------- */
function updateTimestampUI(){
    const now = new Date();
    timestampOverlay.textContent = now.toLocaleTimeString();
}

/* ---------- filter mapping ---------- */
function buildFilterString(){
    switch(currentFilter){
        case 'grayscale': return 'grayscale(100%)';
        case 'sepia': return 'sepia(100%)';
        case 'invert': return 'invert(100%)';
        case 'blur': return 'blur(4px)';
        default: return 'none';
    }
}

/* ---------- draw video to snapshotCanvas continuously ---------- */
function drawFrameToCanvas(){
    if (!cameraFeed || cameraFeed.readyState < 2) {
        drawRaf = requestAnimationFrame(drawFrameToCanvas);
        return;
    }
    const vw = cameraFeed.videoWidth || cameraFeed.clientWidth;
    const vh = cameraFeed.videoHeight || cameraFeed.clientHeight;
    if (snapshotCanvas.width !== vw || snapshotCanvas.height !== vh){
        snapshotCanvas.width = vw;
        snapshotCanvas.height = vh;
    }
    try {
        ctx.filter = buildFilterString();
        ctx.drawImage(cameraFeed, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    } catch(e){}
    ctx.filter = 'none';
    const fontSize = Math.max(14, Math.floor(snapshotCanvas.width * 0.03));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, snapshotCanvas.height - (fontSize + 18), 200, fontSize + 12);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(new Date().toLocaleTimeString(), 18, snapshotCanvas.height - (fontSize/2 + 6));
    drawRaf = requestAnimationFrame(drawFrameToCanvas);
}

/* ---------- snapshot (downloads image) ---------- */
async function takeSnapshot(){
    drawFrameToCanvas();
    if (flashToggle.checked) await simulateFlashOverlay(120);
    snapshotCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snapshot_${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        playSound(660, 240);
        analyzeImage();
    }, 'image/jpeg', 0.92);
}

/* ---------- simulate flash overlay ---------- */
function simulateFlashOverlay(duration = 120){
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.background = '#ffffff';
        overlay.style.opacity = '0.95';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '9999';
        cameraContainer.appendChild(overlay);
        setTimeout(()=> {
            cameraContainer.removeChild(overlay);
            resolve();
        }, duration);
    });
}

/* ---------- AI analysis (POST to Render backend) ---------- */
async function analyzeImage(){
    try {
        const dataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.9);
        const response = await fetch('https://ai-image-analyzer-xz5a.onrender.com/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl })
        });
        if (!response.ok) throw new Error('AI server error');
        const result = await response.json();
        displayResults(result);
    } catch (err) {
        console.warn('AI analysis failed (skipping):', err);
        displayResults({
            objects: [{ name: 'placeholder object', confidence: 0.86 }],
            labels: [{ description: 'example label', confidence: 0.73 }]
        });
    }
}

/* ---------- Display AI results with animated reveal ---------- */
function displayResults(result){
    objectsList.innerHTML = '';
    labelsList.innerHTML = '';

    if (result.objects && Array.isArray(result.objects)){
        result.objects.forEach((obj, idx) => {
            const li = document.createElement('li');
            li.className = 'ai-item';
            li.textContent = `${obj.name} (Confidence: ${(obj.confidence * 100).toFixed(1)}%)`;
            li.style.animationDelay = `${idx * 0.12}s`;
            objectsList.appendChild(li);
        });
    }

    if (result.labels && Array.isArray(result.labels)){
        result.labels.forEach((label, idx) => {
            const li = document.createElement('li');
            li.className = 'ai-item';
            li.textContent = `${label.description} (Confidence: ${(label.confidence * 100).toFixed(1)}%)`;
            li.style.animationDelay = `${( (result.objects?.length || 0) * 0.12) + idx * 0.12}s`;
            labelsList.appendChild(li);
        });
    }

    aiResults.style.display = 'block';
    requestAnimationFrame(() => {
        aiResults.classList.add('show');
    });
    setTimeout(() => {
        aiResults.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 400);
}

/* ---------- Recording ---------- */
let mediaRecorder = null;
let recordedChunks = [];
async function startRecording(){
    if (mediaRecorder && mediaRecorder.state === 'recording') return;
    let audioStream = null;
    if (audioToggle.checked) {
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioTrack = audioStream.getAudioTracks()[0];
        } catch(e){
            audioTrack = null;
        }
    }
    const canvasStream = snapshotCanvas.captureStream(RECORD_FPS);
    if (audioTrack) canvasStream.addTrack(audioTrack);
    const options = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? { mimeType: 'video/webm;codecs=vp9,opus' } : undefined;
    try {
        mediaRecorder = new MediaRecorder(canvasStream, options);
    } catch (err) {
        try { mediaRecorder = new MediaRecorder(canvasStream); } catch(e) { alert('Recording unavailable'); return; }
    }
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording_${new Date().toISOString().replace(/[:.]/g,'-')}.webm`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        if (audioTrack) { audioTrack.stop(); audioTrack = null; }
    };
    mediaRecorder.start();
    recordBtn.style.display = 'none';
    stopRecordBtn.style.display = 'inline-block';
    playSound(520, 200);
}
function stopRecording(){
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    recordBtn.style.display = 'inline-block';
    stopRecordBtn.style.display = 'none';
}

/* ---------- Countdown ---------- */
function disableControlsDuringCountdown(disable){
    snapshotBtn.disabled = disable;
    recordBtn.disabled = disable;
    settingsBtn.disabled = disable;
}
function startCountdown(callback, duration = 3){
    if (isCountingDown) return;
    isCountingDown = true;
    let count = duration;
    countdownDisplay.textContent = count;
    countdownDisplay.style.display = 'flex';
    countdownDisplay.setAttribute('aria-hidden', 'false');
    disableControlsDuringCountdown(true);
    countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownDisplay.textContent = count;
            playSound(880, 120);
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownDisplay.style.display = 'none';
            countdownDisplay.setAttribute('aria-hidden', 'true');
            disableControlsDuringCountdown(false);
            isCountingDown = false;
            playSound(880, 260);
            callback();
        }
    }, 1000);
}
function cancelCountdown(){
    if (!isCountingDown) return;
    clearInterval(countdownInterval);
    countdownInterval = null;
    countdownDisplay.style.display = 'none';
    disableControlsDuringCountdown(false);
    isCountingDown = false;
}

/* ---------- zoom, torch, filters, resolution, fullscreen ---------- */
async function initZoomCapabilities(){
    if (!stream) return;
    videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || typeof videoTrack.getCapabilities !== 'function') { supportsZoom = false; return; }
    const caps = videoTrack.getCapabilities();
    supportsZoom = !!caps.zoom;
}
async function setHardwareZoom(value){
    if (!videoTrack || !supportsZoom) return false;
    try { await videoTrack.applyConstraints({ advanced: [{ zoom: value }] }); zoomLevel = value; return true; }
    catch(e){ return false; }
}
async function zoomIn(){
    ensureAudioContext();
    if (supportsZoom) {
        await setHardwareZoom(Math.min(3, zoomLevel + 0.1));
    } else {
        zoomLevel = Math.min(3, zoomLevel + 0.1);
        cameraFeed.style.transform = `scale(${zoomLevel})`;
    }
    playSound(523, 160);
}
async function zoomOut(){
    ensureAudioContext();
    if (supportsZoom) {
        await setHardwareZoom(Math.max(1, zoomLevel - 0.1));
    } else {
        zoomLevel = Math.max(1, zoomLevel - 0.1);
        cameraFeed.style.transform = `scale(${zoomLevel})`;
    }
    playSound(392, 160);
}
async function initTorchCapability(){
    if (!stream) return;
    videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || typeof videoTrack.getCapabilities !== 'function') { useHardwareTorch = false; return; }
    useHardwareTorch = !!videoTrack.getCapabilities().torch;
}
async function toggleTorch(enable){
    if (!videoTrack) return false;
    try { await videoTrack.applyConstraints({ advanced: [{ torch: !!enable }] }); return true; } catch(e){ return false; }
}
async function changeResolution(){
    const [w,h] = resolutionSelect.value.split('x').map(v => parseInt(v,10));
    await startCamera({ video: { facingMode: 'environment', width: { ideal: w }, height: { ideal: h } }, audio: false });
    playSound(494, 200);
}
function toggleFullscreen(){
    if (!document.fullscreenElement) {
        cameraContainer.requestFullscreen?.();
    } else {
        document.exitFullscreen?.();
    }
}

/* ---------- apply filters ---------- */
function applyFilter(filterName){
    currentFilter = filterName || 'none';
    cameraFeed.style.filter = buildFilterString();
    playSound(440, 160);
}

/* ---------- camera start/stop ---------- */
async function startCamera(constraints = { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }){
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; videoTrack = null; audioTrack = null; }
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraFeed.srcObject = stream;
        cameraFeed.playsInline = true;
        await cameraFeed.play();
        videoTrack = stream.getVideoTracks()[0] || null;
        audioTrack = stream.getAudioTracks()[0] || null;
        await initZoomCapabilities();
        await initTorchCapability();
        if (!drawRaf) drawFrameToCanvas();
        setInterval(updateTimestampUI, 1000);
        ensureAudioContext();
    } catch(err){
        console.error('Camera error', err);
        alert('Could not access camera. Check permissions.');
    }
}

/* ---------- Event wiring ---------- */
function handleUserGesture(){
    ensureAudioContext();
    if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(()=>{});
}
snapshotBtn.addEventListener('click', (e) => {
    handleUserGesture();
    if (isCountingDown) { cancelCountdown(); return; }
    startCountdown(takeSnapshot, 3);
});
countdownDisplay.addEventListener('click', cancelCountdown);

recordBtn.addEventListener('click', () => {
    handleUserGesture();
    if (isCountingDown) { cancelCountdown(); return; }
    startCountdown(startRecording, 3);
});
stopRecordBtn.addEventListener('click', stopRecording);

fullscreenBtn.addEventListener('click', toggleFullscreen);
zoomInBtn.addEventListener('click', zoomIn);
zoomOutBtn.addEventListener('click', zoomOut);
settingsBtn.addEventListener('click', () => {
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
    playSound(330, 120);
});
resolutionSelect.addEventListener('change', changeResolution);

filterBtns.forEach(btn => btn.addEventListener('click', () => applyFilter(btn.dataset.filter || 'none')));
flashToggle.addEventListener('change', async () => {
    if (flashToggle.checked && useHardwareTorch) { await toggleTorch(true); await toggleTorch(false); }
});
audioToggle.addEventListener('change', () => { if (audioToggle.checked) handleUserGesture(); });

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); snapshotBtn.click(); }
});

/* ---------- init on load ---------- */
startCamera({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });

window.addEventListener('beforeunload', () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (audioTrack) audioTrack.stop();
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    if (drawRaf) cancelAnimationFrame(draw
