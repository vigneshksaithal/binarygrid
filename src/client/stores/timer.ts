import { writable } from "svelte/store";

const elapsedSeconds = writable(0);

let interval: ReturnType<typeof setInterval> | null = null;
const TICK_MS = 1000;

const canUseWindow = () => typeof window !== "undefined";

export const startTimer = () => {
	if (!canUseWindow()) {
		return;
	}
	if (interval) {
		return;
	}
	interval = setInterval(() => {
		elapsedSeconds.update((value) => value + 1);
	}, TICK_MS);
};

export const stopTimer = () => {
	if (!interval) {
		return;
	}
	clearInterval(interval);
	interval = null;
};

export const resetTimer = () => {
	stopTimer();
	elapsedSeconds.set(0);
};

export const formatElapsedTime = (elapsed: number) => {
	const minutes = Math.floor(elapsed / 60);
	const seconds = elapsed % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export { elapsedSeconds };
