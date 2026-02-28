# Project Agent Notes

- In Svelte template handlers (`on:click`, `on:keydown`, etc.), do not use TypeScript assertions with `as`.
- If type narrowing is needed for handler logic, move it into `<script lang="ts">` helper functions.
- Chat responses must always be in Russian.
- Code comments must always be in English.
