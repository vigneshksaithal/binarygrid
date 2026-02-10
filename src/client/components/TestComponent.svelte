<script lang="ts">
	import TimerIcon from '@lucide/svelte/icons/timer'
	import TrophyIcon from '@lucide/svelte/icons/trophy'
	import { SIZE } from '../../shared/rules'
	import type { Grid } from '../../shared/types/puzzle'
	import { game } from '../stores/game'
	import { elapsedSeconds } from '../stores/timer'
	import {
		openHowToModal,
		openLeaderboardModal,
		openPlayOverlay,
		showSuccessModal,
	} from '../stores/ui'
	import Button from './Button.svelte'
	import Cell from './Cell.svelte'
	import GridComponent from './Grid.svelte'
	import HowToPlayModal from './HowToPlayModal.svelte'
	import LeaderboardModal from './LeaderboardModal.svelte'
	import Modal from './Modal.svelte'
	import PlayOverlay from './PlayOverlay.svelte'
	import SuccessModal from './SuccessModal.svelte'
	import Timer from './Timer.svelte'

	let testModalOpen = $state(false)
	let testAlertModalOpen = $state(false)

	const createMockGrid = (fillValue: 0 | 1 | null = null): Grid => {
		return Array.from({ length: SIZE }, () =>
			Array.from({ length: SIZE }, () => fillValue),
		)
	}

	const createSolvedGrid = (): Grid => {
		const grid: Grid = createMockGrid(null)
		for (let r = 0; r < SIZE; r++) {
			const row = grid[r]
			if (!row) {
				continue
			}
			for (let c = 0; c < SIZE; c++) {
				const shouldBeOne = (r + c) % 2 === 0
				row[c] = shouldBeOne ? 1 : 0
			}
		}
		return grid
	}

	const setGameState = (
		status: 'idle' | 'loading' | 'in_progress' | 'solved' | 'invalid' | 'error',
	) => {
		const mockGrid = createMockGrid(null)
		const mockFixed = [{ r: 0, c: 0, v: 1 as const }]

		if (status === 'loading') {
			game.set({
				puzzleId: 'test-123',
				difficulty: 'medium',
				grid: mockGrid,
				initial: mockGrid,
				fixed: mockFixed,
				fixedSet: new Set(['0,0']),
				status: 'loading',
				errors: [],
				errorLocations: undefined,
				errorCells: new Set(),
				solution: null,
				dateISO: null,
				history: [],
				lastHintedCell: null,
			})
		} else if (status === 'solved') {
			const solvedGrid = createSolvedGrid()
			game.set({
				puzzleId: 'test-123',
				difficulty: 'medium',
				grid: solvedGrid,
				initial: mockGrid,
				fixed: mockFixed,
				fixedSet: new Set(['0,0']),
				status: 'solved',
				errors: [],
				errorLocations: undefined,
				errorCells: new Set(),
				solution: solvedGrid,
				dateISO: null,
				history: [],
				lastHintedCell: null,
			})
		} else if (status === 'invalid') {
			const invalidGrid = createMockGrid(1)
			game.set({
				puzzleId: 'test-123',
				difficulty: 'medium',
				grid: invalidGrid,
				initial: mockGrid,
				fixed: mockFixed,
				fixedSet: new Set(['0,0']),
				status: 'invalid',
				errors: [
					'Row 0 has too many 1s',
					'Column 0 has too many 1s',
					'Row 0 has three consecutive 1s',
				],
				errorLocations: {
					rows: [0, 1],
					columns: [0, 1],
				},
				errorCells: new Set(['0,0', '0,1', '0,2', '1,0', '2,0']),
				solution: null,
				dateISO: null,
				history: [],
				lastHintedCell: null,
			})
		} else if (status === 'error') {
			game.set({
				puzzleId: null,
				difficulty: 'medium',
				grid: mockGrid,
				initial: mockGrid,
				fixed: [],
				fixedSet: new Set(),
				status: 'error',
				errors: ['Failed to load puzzle', 'HTTP 500'],
				errorLocations: undefined,
				errorCells: new Set(),
				solution: null,
				dateISO: null,
				history: [],
				lastHintedCell: null,
			})
		} else if (status === 'in_progress') {
			const inProgressGrid = createMockGrid(null)
			const row0 = inProgressGrid[0]
			const row1 = inProgressGrid[1]
			if (row0) {
				row0[0] = 1
				row0[1] = 0
			}
			if (row1) {
				row1[0] = 0
			}
			game.set({
				puzzleId: 'test-123',
				difficulty: 'medium',
				grid: inProgressGrid,
				initial: mockGrid,
				fixed: mockFixed,
				fixedSet: new Set(['0,0']),
				status: 'in_progress',
				errors: [],
				errorLocations: undefined,
				errorCells: new Set(),
				solution: null,
				dateISO: null,
				history: [],
				lastHintedCell: null,
			})
		} else {
			game.set({
				puzzleId: null,
				difficulty: 'medium',
				grid: mockGrid,
				initial: mockGrid,
				fixed: [],
				fixedSet: new Set(),
				status: 'idle',
				errors: [],
				errorLocations: undefined,
				errorCells: new Set(),
				solution: null,
				dateISO: null,
				history: [],
				lastHintedCell: null,
			})
		}
	}

	const setMockTimer = (seconds: number) => {
		elapsedSeconds.set(seconds)
	}
</script>

<div class="w-full max-w-4xl mx-auto p-6 space-y-8">
	<h1 class="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
		Test Component
	</h1>

	<!-- Modals Section -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
			Modals
		</h2>
		<div class="flex flex-wrap gap-2">
			<Button onClick={openHowToModal}>Show How To Play Modal</Button>
			<Button onClick={openLeaderboardModal} variant="secondary"
				>Show Leaderboard Modal</Button
			>
			<Button onClick={openPlayOverlay}>Show Play Overlay</Button>
			<Button onClick={() => showSuccessModal.set(true)} variant="secondary"
				>Show Success Modal</Button
			>
			<Button onClick={() => (testModalOpen = true)} variant="secondary"
				>Show Base Modal (Dialog)</Button
			>
			<Button onClick={() => (testAlertModalOpen = true)} variant="secondary"
				>Show Base Modal (AlertDialog)</Button
			>
		</div>
	</section>

	<!-- Button Variants Section -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
			Button Variants
		</h2>
		<div class="space-y-3">
			<div class="flex flex-wrap gap-2 items-center">
				<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
					>Default:</span
				>
				<Button>Default Button</Button>
				<Button disabled>Disabled Default</Button>
			</div>
			<div class="flex flex-wrap gap-2 items-center">
				<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
					>Secondary:</span
				>
				<Button variant="secondary">Secondary Button</Button>
				<Button variant="secondary" disabled>Disabled Secondary</Button>
			</div>
			<div class="flex flex-wrap gap-2 items-center">
				<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
					>Destructive:</span
				>
			</div>
			<div class="flex flex-wrap gap-2 items-center">
				<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
					>With Icons:</span
				>
				<Button>
					<TrophyIcon class="size-5" />
					<span>With Trophy Icon</span>
				</Button>
				<Button variant="secondary">
					<TimerIcon class="size-5" />
					<span>With Timer Icon</span>
				</Button>
			</div>
		</div>
	</section>

	<!-- Game Components Section -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
			Game Components
		</h2>

		<!-- Grid Component -->
		<div class="space-y-4">
			<h3 class="text-xl font-medium text-neutral-700 dark:text-neutral-300">
				Grid Component
			</h3>
			<p class="text-sm text-neutral-600 dark:text-neutral-400">
				Use the Game State Testing section below to change the grid state and
				see how it renders.
			</p>
			<div class="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
				<GridComponent />
			</div>
		</div>

		<!-- Cell States -->
		<div class="space-y-4">
			<h3 class="text-xl font-medium text-neutral-700 dark:text-neutral-300">
				Cell States
			</h3>
			<div class="grid grid-cols-3 gap-4 max-w-md">
				<div class="space-y-2">
					<p class="text-xs text-neutral-600 dark:text-neutral-400">Empty</p>
					<Cell />
				</div>
				<div class="space-y-2">
					<p class="text-xs text-neutral-600 dark:text-neutral-400">Value 0</p>
					<Cell value={0} />
				</div>
				<div class="space-y-2">
					<p class="text-xs text-neutral-600 dark:text-neutral-400">Value 1</p>
					<Cell value={1} />
				</div>
				<div class="space-y-2">
					<p class="text-xs text-neutral-600 dark:text-neutral-400">Fixed</p>
					<Cell value={1} fixed />
				</div>
				<div class="space-y-2">
					<p class="text-xs text-neutral-600 dark:text-neutral-400">
						With Error
					</p>
					<Cell value={0} hasError />
				</div>
				<div class="space-y-2">
					<p class="text-xs text-neutral-600 dark:text-neutral-400">
						Fixed + Error
					</p>
					<Cell value={1} fixed hasError />
				</div>
			</div>
		</div>

		<!-- Timer -->
		<div class="space-y-4">
			<h3 class="text-xl font-medium text-neutral-700 dark:text-neutral-300">
				Timer Component
			</h3>
			<div class="flex items-center gap-4">
				<Timer />
				<div class="flex gap-2">
					<Button variant="secondary" onClick={() => setMockTimer(0)}
						>Reset</Button
					>
					<Button variant="secondary" onClick={() => setMockTimer(45)}
						>45s</Button
					>
					<Button variant="secondary" onClick={() => setMockTimer(125)}
						>2:05</Button
					>
					<Button variant="secondary" onClick={() => setMockTimer(3661)}
						>1:01:01</Button
					>
				</div>
			</div>
		</div>
	</section>

	<!-- Game State Testing Section -->
	<section class="space-y-4">
		<h2 class="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
			Game State Testing
		</h2>
		<div class="space-y-4">
			<div class="flex flex-wrap gap-2">
				<Button onClick={() => setGameState('idle')} variant="secondary"
					>Set Idle</Button
				>
				<Button onClick={() => setGameState('loading')} variant="secondary"
					>Set Loading</Button
				>
				<Button onClick={() => setGameState('in_progress')} variant="secondary"
					>Set In Progress</Button
				>
				<Button onClick={() => setGameState('solved')} variant="secondary"
					>Set Solved</Button
				>
				<Button onClick={() => setGameState('invalid')} variant="secondary"
					>Set Invalid</Button
				>
			</div>
			<div class="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
				<p
					class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
				>
					Current Game State:
				</p>
				<pre
					class="text-xs text-neutral-600 dark:text-neutral-400 overflow-auto">{JSON.stringify(
						$game,
						null,
						2,
					)}</pre>
			</div>
			<div class="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
				<GridComponent />
			</div>
		</div>
	</section>
</div>

<!-- All Modal Components (rendered conditionally) -->
<HowToPlayModal />
<LeaderboardModal />
<PlayOverlay />
<SuccessModal />

<!-- Test Base Modals -->
<Modal
	open={testModalOpen}
	onClose={() => (testModalOpen = false)}
	labelledby="test-modal-title"
	describedby="test-modal-description"
	role="dialog"
>
	<h2 id="test-modal-title">Test Dialog Modal</h2>
	<p id="test-modal-description">
		This is a test of the base Modal component as a dialog.
	</p>
	<footer class="flex justify-end mt-4">
		<Button onClick={() => (testModalOpen = false)}>Close</Button>
	</footer>
</Modal>

<Modal
	open={testAlertModalOpen}
	onClose={() => (testAlertModalOpen = false)}
	labelledby="test-alert-title"
	role="alertdialog"
>
	<h2 id="test-alert-title">Test Alert Dialog Modal</h2>
	<p>This is a test of the base Modal component as an alertdialog.</p>
	<footer class="flex justify-end gap-2 mt-4">
		<Button variant="secondary" onClick={() => (testAlertModalOpen = false)}
			>Cancel</Button
		>
		<Button onClick={() => (testAlertModalOpen = false)}>Confirm</Button>
	</footer>
</Modal>
