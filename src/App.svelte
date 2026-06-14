<script lang="ts">
  import { LEVELS } from './game/levels';
  import Landing from './game/Landing.svelte';
  import GameScreen from './game/GameScreen.svelte';

  let route = $state(location.hash);
  $effect(() => {
    const f = () => (route = location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  });
  const inGame = $derived(route.startsWith('#play') || LEVELS.some(l => '#' + l.id === route));
</script>

{#if inGame}
  <GameScreen />
{:else}
  <Landing />
{/if}
