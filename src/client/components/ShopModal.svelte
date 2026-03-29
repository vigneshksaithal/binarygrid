<script lang="ts">
	import type { ShopItem, ShopResponse } from '../../shared/types/economy'
	import Modal from './Modal.svelte'

	type Props = {
		open: boolean
		onClose: () => void
	}

	let { open, onClose }: Props = $props()

	let shopData = $state<ShopResponse | null>(null)
	let loading = $state(false)
	let error = $state<string | null>(null)
	let actionMessage = $state<string | null>(null)
	let actionSuccess = $state<boolean | null>(null)

	const fetchShop = async () => {
		loading = true
		error = null
		try {
			const res = await fetch('/api/shop')
			if (res.ok) {
				shopData = await res.json()
			} else {
				error = 'Failed to load shop'
			}
		} catch {
			error = 'Network error'
		} finally {
			loading = false
		}
	}

	$effect(() => {
		if (open) {
			fetchShop()
			actionMessage = null
			actionSuccess = null
		}
	})

	const handleBuy = async (item: ShopItem) => {
		actionMessage = null
		actionSuccess = null
		try {
			const res = await fetch('/api/shop/buy', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ titleId: item.id }),
			})
			const data = await res.json()
			if (data.success) {
				actionMessage = `Purchased ${item.emoji} ${item.label}!`
				actionSuccess = true
				await fetchShop()
			} else {
				actionMessage = data.error ?? 'Purchase failed'
				actionSuccess = false
			}
		} catch {
			actionMessage = 'Network error'
			actionSuccess = false
		}
	}

	const handleEquip = async (item: ShopItem) => {
		actionMessage = null
		actionSuccess = null
		try {
			const res = await fetch('/api/shop/equip', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ titleId: item.id }),
			})
			const data = await res.json()
			if (data.success) {
				actionMessage = `Equipped ${item.emoji} ${item.label}!`
				actionSuccess = true
				await fetchShop()
			} else {
				actionMessage = data.error ?? 'Equip failed'
				actionSuccess = false
			}
		} catch {
			actionMessage = 'Network error'
			actionSuccess = false
		}
	}

	const getConditionLabel = (item: ShopItem): string => {
		if (!item.condition) return ''
		const { type, value } = item.condition
		if (type === 'minSolves') return `${value} total solves`
		if (type === 'minSpeedSolves') return `${value} speed solves`
		if (type === 'minLongestStreak') return `${value}-day streak`
		return ''
	}
</script>

<Modal {open} {onClose} labelledby="shop-modal-title" describedby="shop-modal-body">
	<div id="shop-modal-body" class="space-y-4">
		<!-- Header -->
		<div class="text-center">
			<h2
				id="shop-modal-title"
				class="text-2xl font-bold text-yellow-400 mb-1"
			>
				🛒 Title Shop
			</h2>
			{#if shopData !== null}
				<p class="text-sm text-zinc-400">
					Your balance: <span class="font-bold text-yellow-400">🪙 {shopData.coins}</span>
				</p>
			{/if}
		</div>

		<!-- Action feedback -->
		{#if actionMessage !== null}
			<div
				class={`text-center py-2 px-4 rounded-lg text-sm font-semibold ${
					actionSuccess
						? 'bg-green-900/50 text-green-300'
						: 'bg-red-900/50 text-red-300'
				}`}
			>
				{actionMessage}
			</div>
		{/if}

		<!-- Loading / Error states -->
		{#if loading}
			<div class="text-center py-8 text-zinc-400">Loading…</div>
		{:else if error}
			<div class="text-center py-4 text-red-400">{error}</div>
		{:else if shopData}
			<!-- Title list -->
			<div class="space-y-2">
				{#each shopData.items as item (item.id)}
					<div
						class={`flex items-center justify-between rounded-xl p-3 border ${
							item.equipped
								? 'bg-yellow-900/30 border-yellow-600/50'
								: 'bg-zinc-700/50 border-zinc-600/30'
						}`}
					>
						<!-- Left: title info -->
						<div class="flex items-center gap-2 min-w-0">
							<span class="text-2xl">{item.emoji}</span>
							<div class="min-w-0">
								<div class="flex items-center gap-1.5">
									<span class="text-sm font-semibold text-zinc-100">{item.label}</span>
									{#if item.equipped}
										<span class="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">Equipped</span>
									{:else if item.owned}
										<span class="text-xs bg-zinc-600/50 text-zinc-400 px-1.5 py-0.5 rounded-full">Owned</span>
									{/if}
								</div>
								{#if item.condition && !item.unlocked}
									<p class="text-xs text-zinc-500 mt-0.5">
										🔒 Requires {getConditionLabel(item)}
									</p>
								{:else if item.cost > 0 && !item.owned}
									<p class="text-xs text-zinc-400 mt-0.5">🪙 {item.cost} coins</p>
								{:else if item.cost === 0 && !item.owned}
									<p class="text-xs text-zinc-400 mt-0.5">Free</p>
								{/if}
							</div>
						</div>

						<!-- Right: action button -->
						<div class="ml-3 shrink-0">
							{#if item.equipped}
								<span class="text-xs text-yellow-500 font-medium">✓ Active</span>
							{:else if item.owned}
								<button
									onclick={() => handleEquip(item)}
									class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-600 hover:bg-zinc-500 text-zinc-100 transition-colors"
								>
									Equip
								</button>
							{:else if !item.unlocked}
								<span class="text-xs text-zinc-600 font-medium">Locked</span>
							{:else if shopData && shopData.coins >= item.cost}
								<button
									onclick={() => handleBuy(item)}
									class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white transition-colors"
								>
									Buy
								</button>
							{:else}
								<span class="text-xs text-zinc-600 font-medium">Need more 🪙</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Earn coins hint -->
		<p class="text-center text-xs text-zinc-500">
			Earn 🪙 coins by solving puzzles. Bonus for speed, streaks &amp; daily first solve!
		</p>
	</div>
</Modal>
