// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Shiki transformer: when a fenced code block's meta string contains the
// token `run` (e.g. ```java run), tag the rendered <pre> with the `runnable`
// class. CodeRunner.astro picks up `pre.runnable` on the client and wires in a
// Run button that executes the code via Judge0.
const runnableTransformer = {
	name: 'runnable-marker',
	pre(node) {
		const raw = this.options.meta?.__raw;
		if (raw && /(^|\s)run(\s|$)/.test(raw)) {
			this.addClassToHast(node, 'runnable');
		}
	},
};

// https://astro.build/config
export default defineConfig({
	site: 'https://adikatre.github.io',
	base: '/blog',
	trailingSlash: "always",
	integrations: [mdx(), sitemap()],
	markdown: {
		shikiConfig: {
			transformers: [runnableTransformer],
		},
	},
});
