///////////////////////////////////////
// Beep sound
//   duration: msec
///////////////////////////////////////
export function playBeepSound(duration: number): void {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = 1000;
    gainNode.gain.value = 0.1;

    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000);
};

