import { defineConfig } from 'vite';

/**
 * Seven bundles, fourteen passes.
 *
 * They are separate because they load on entirely different schedules. `fields`
 * is the only one most people ever download: it is the field runtime, and it
 * ships to anyone editing a post that has a field group on it. `builder`,
 * `model`, `tools` and `bulk` are windows, loaded lazily the first time each one
 * opens. `dock` is a couple of hundred bytes that has to be present at boot for
 * the tile to exist at all, and `widget` only reaches somebody who has put the
 * Field Inspector on their wallpaper.
 *
 * A single bundle would make every author downloading a post editor also
 * download a graph renderer they will never open.
 *
 * Each target builds twice: `--mode development` emits the readable file
 * WordPress serves under `SCRIPT_DEBUG`, `--mode production` the minified one.
 * `emptyOutDir` is off so the second pass does not delete the first pass's
 * output -- and so `builder` does not delete `fields`.
 *
 * Which target a pass builds comes from `ATCF_TARGET`, because Vite's library
 * mode takes one entry per config.
 */
const TARGETS = {
	fields: {
		entry: 'src/controls/index.ts',
		fileBase: 'fields',
		iifeName: 'allTerrainFields',
	},
	builder: {
		entry: 'src/builder/index.ts',
		fileBase: 'builder',
		iifeName: 'allTerrainFieldsBuilder',
	},
	model: {
		entry: 'src/model/index.ts',
		fileBase: 'model',
		iifeName: 'allTerrainFieldsModel',
	},
	tools: {
		entry: 'src/tools.ts',
		fileBase: 'tools',
		iifeName: 'allTerrainFieldsTools',
	},
	bulk: {
		entry: 'src/bulk.ts',
		fileBase: 'bulk',
		iifeName: 'allTerrainFieldsBulk',
	},
	widget: {
		entry: 'src/widget.ts',
		fileBase: 'widget',
		iifeName: 'allTerrainFieldsWidget',
	},
	dock: {
		entry: 'src/dock.ts',
		fileBase: 'dock',
		iifeName: 'allTerrainFieldsDock',
	},
};

export default defineConfig( ( { mode } ) => {
	const name = process.env.ATCF_TARGET || 'fields';
	const target = TARGETS[ name ];

	if ( ! target ) {
		throw new Error(
			`Unknown ATCF_TARGET "${ name }". Expected one of: ${ Object.keys( TARGETS ).join( ', ' ) }.`
		);
	}

	const isProd = mode === 'production';

	return {
		build: {
			outDir: 'assets/js',
			emptyOutDir: false,
			target: 'es2020',
			minify: isProd ? 'esbuild' : false,
			sourcemap: false,
			lib: {
				entry: target.entry,
				formats: [ 'iife' ],
				name: target.iifeName,
				fileName: () => `${ target.fileBase }${ isProd ? '.min' : '' }.js`,
			},
		},
		test: {
			environment: 'jsdom',
			include: [ 'tests/vitest/**/*.test.ts' ],
		},
	};
} );
