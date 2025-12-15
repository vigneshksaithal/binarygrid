<script lang="ts">
	import InfoIcon from '@lucide/svelte/icons/info'
	import TrophyIcon from '@lucide/svelte/icons/trophy'
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

	$effect.pre(() => {
		openPlayOverlay()
	})
</script>

<main
	class="min-h-screen flex flex-col justify-center w-full max-w-sm mx-auto p-2"
>
	<div class="flex justify-between items-center mb-4">
		<div class="flex items-center gap-2">
			<Button
				variant="ghost"
				size="sm"
				onClick={openHowToModal}
				ariaLabel="How to Play"
			>
				<InfoIcon class="size-6" />
				<span class="sr-only">How to Play</span>
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onClick={openLeaderboardModal}
				ariaLabel="Leaderboard"
			>
				<TrophyIcon class="size-6" />
				<span class="sr-only">Leaderboard</span>
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
