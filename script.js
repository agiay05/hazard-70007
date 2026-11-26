const $ = id => document.getElementById(id);

let audioContext;
let masterGain;
let volume = 0.45;
let sirenTimer = null;
let sirenOscillators = [];
let lightTimer = null;
let lightsEnabled = false;
let radioStream = null;
let radioRecorder = null;
let radioChunks = [];
let transmitting = false;

function initAudio() {
if (!audioContext) {
audioContext = new (window.AudioContext || window.webkitAudioContext)();
masterGain = audioContext.createGain();
masterGain.gain.value = volume;
masterGain.connect(audioContext.destination);
}

if (audioContext.state === "suspended") {
audioContext.resume();
}
}

function tone(frequency, duration = 0.25, type = "square", level = 0.3) {
initAudio();

const oscillator = audioContext.createOscillator();
const gain = audioContext.createGain();

oscillator.type = type;
oscillator.frequency.value = frequency;

gain.gain.setValueAtTime(level, audioContext.currentTime);
gain.gain.exponentialRampToValueAtTime(
0.001,
audioContext.currentTime + duration
);

oscillator.connect(gain);
gain.connect(masterGain);

oscillator.start();
oscillator.stop(audioContext.currentTime + duration);
}

function stopSiren() {
if (sirenTimer) {
clearInterval(sirenTimer);
sirenTimer = null;
}

sirenOscillators.forEach(osc => {
try { osc.stop(); } catch {}
});

sirenOscillators = [];
$("mode").textContent = "STANDBY";
$("status").textContent = "SYSTEM READY";
$("siren").classList.remove("active");
}

function startSiren() {
initAudio();
stopSiren();

$("mode").textContent = "SIREN";
$("status").textContent = "SOUND ACTIVE";
$("siren").classList.add("active");

let high = false;

sirenTimer = setInterval(() => {
high = !high;
tone(high ? 950 : 650, 0.38, "sawtooth", 0.25);
}, 400);
}

$("siren").addEventListener("click", () => {
initAudio();

if (sirenTimer) {
stopSiren();
} else {
startSiren();
}
});

$("man").addEventListener("click", () => {
initAudio();
tone(720, 0.4, "square");
$("mode").textContent = "MANUAL";
$("status").textContent = "MANUAL TONE";
});

$("horn").addEventListener("click", () => {
initAudio();
tone(420, 0.7, "sawtooth", 0.4);
});

$("airhorn").addEventListener("click", () => {
initAudio();
tone(180, 0.9, "sawtooth", 0.5);
setTimeout(() => tone(220, 0.6, "sawtooth", 0.4), 250);
});

function toggleLights() {
lightsEnabled = !lightsEnabled;

$("lights").classList.toggle("active", lightsEnabled);

if (lightTimer) {
clearInterval(lightTimer);
lightTimer = null;
}

if (!lightsEnabled) {
$("redLight").classList.remove("active");
$("blueLight").classList.remove("active");
return;
}

let state = false;

lightTimer = setInterval(() => {
state = !state;
$("redLight").classList.toggle("active", state);
$("blueLight").classList.toggle("active", !state);
}, 180);
}

$("lights").addEventListener("click", toggleLights);

$("radio").addEventListener("click", () => {
initAudio();
tone(1000, 0.1);
$("radioStatus").textContent = "RADIO READY";
});

$("volume").addEventListener("input", event => {
volume = Number(event.target.value) / 100;

if (masterGain) {
masterGain.gain.value = volume;
}
});

// Push-to-talk: record and play back your own voice
$("ptt").addEventListener("pointerdown", async event => {
event.preventDefault();

if (transmitting) return;

try {
radioStream = await navigator.mediaDevices.getUserMedia({
audio: true
});

radioRecorder = new MediaRecorder(radioStream);
radioChunks = [];

radioRecorder.ondataavailable = event => {
if (event.data.size) radioChunks.push(event.data);
};

radioRecorder.onstop = () => {
const recording = new Blob(radioChunks, {
type: radioRecorder.mimeType
});

const audioURL = URL.createObjectURL(recording);
const playback = new Audio(audioURL);

playback.volume = volume;
playback.play();

playback.onended = () => URL.revokeObjectURL(audioURL);

radioStream.getTracks().forEach(track => track.stop());
radioStream = null;
};

radioRecorder.start();
transmitting = true;

$("ptt").textContent = "TRANSMITTING...";
$("radioStatus").textContent = "TRANSMISSION ACTIVE";

} catch (error) {
$("radioStatus").textContent = "MICROPHONE ACCESS DENIED";
}
});

function stopRadio() {
if (!transmitting) return;

transmitting = false;

if (radioRecorder && radioRecorder.state !== "inactive") {
radioRecorder.stop();
}

$("ptt").textContent = "HOLD TO TALK";
$("radioStatus").textContent = "TRANSMISSION COMPLETE";
}

$("ptt").addEventListener("pointerup", stopRadio);
$("ptt").addEventListener("pointerleave", stopRadio);
$("ptt").addEventListener("pointercancel", stopRadio);

document.addEventListener("visibilitychange", () => {
if (document.hidden) {
stopSiren();

if (lightsEnabled) {
lightsEnabled = false;
clearInterval(lightTimer);
lightTimer = null;
$("redLight").classList.remove("active");
$("blueLight").classList.remove("active");
$("lights").classList.remove("active");
}

stopRadio();
}
});
