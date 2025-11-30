<script lang="ts">
	import TrophyIcon from '@lucide/svelte/icons/trophy'
	import { onMount } from 'svelte'
	import './app.css'
	import Button from './components/Button.svelte'
	import Grid from './components/Grid.svelte'
	import HowToPlayModal from './components/HowToPlayModal.svelte'
	import LeaderboardModal from './components/LeaderboardModal.svelte'
	import PlayOverlay from './components/PlayOverlay.svelte'
	import SuccessModal from './components/SuccessModal.svelte'
	import Timer from './components/Timer.svelte'
	import {
		openHowToModal,
		openLeaderboardModal,
		openPlayOverlay,
	} from './stores/ui'

	onMount(() => {
		openPlayOverlay()
	})
</script>

<main
	class="w-full max-w-sm mx-auto flex flex-col justify-center items-center p-4"
>
	<div class="w-full flex items-center justify-between mb-6">
		<div class="flex items-center gap-2">
			<Button
				variant="default"
				onClick={openLeaderboardModal}
				ariaLabel="Leaderboard"
			>
				<TrophyIcon class="size-5" />
				<span class="sr-only">Leaderboard</span>
			</Button>
			<Button
				variant="default"
				onClick={openHowToModal}
				ariaLabel="How to Play"
			>
				How to Play
			</Button>
		</div>
		<Timer />
	</div>
	<Grid />
</main>

<PlayOverlay />
<HowToPlayModal />
<SuccessModal />
<LeaderboardModal />
