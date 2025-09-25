<script lang="ts">
	import { onMount } from "svelte"

let count: number = $state(0)
let message: string = $state('')
let score: number = $state(0)

const increment = () => {
	count += 1
}

const saveScore = async () => {
	const res = await fetch('/api/saveScore', { method: 'POST', body: JSON.stringify({ score: count }) })
	const data = await res.json()
	console.log(data)

  const getScore = await fetch('/api/getScore', { method: 'GET' })
	const scoreData = await getScore.json()
	console.log(scoreData)
  score = scoreData.score
}

onMount( async () => {
	const res = await fetch('/api/test', { method: 'GET' })
	const data = await res.json()
  console.log(data)
	message = data
})
</script>

Score: {score}
Message: {message}
<button class="bg-blue-500 text-white p-2 rounded-md" onclick={increment}>
  count is {count}
</button>

<button class="bg-blue-500 text-white p-2 rounded-md" onclick={saveScore}>
  save score
</button>
