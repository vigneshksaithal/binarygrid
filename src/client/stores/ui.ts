import { writable } from 'svelte/store'

export const showHowToModal = writable(false)

export const openHowTo = () => showHowToModal.set(true)
export const closeHowTo = () => showHowToModal.set(false)

type SuccessModalState = {
  isOpen: boolean;
  finalTime: number | null;
};

export const successModal = writable<SuccessModalState>({
  isOpen: false,
  finalTime: null,
});

export const openSuccessModal = (finalTime: number) =>
  successModal.set({ isOpen: true, finalTime });
export const closeSuccessModal = () =>
  successModal.set({ isOpen: false, finalTime: null });