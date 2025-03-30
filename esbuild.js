const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctxComponentsWebView = await esbuild.context({
    entryPoints: ['src/web-components/main.ts'],
    bundle: true,
    format: 'esm',
    minify: production,
    sourcemap: !production ? 'inline' : false,
    sourcesContent: false,
    platform: 'browser',
    outfile: 'dist/webview-components.js',
    external: ['vscode'],
    logLevel: 'warning',
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  });
  const ctxExtension = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production ? 'inline' : false,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'warning',
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  });
  if (watch) {
    const componentsWebWatched = ctxComponentsWebView.watch();
    const extensionWatched = ctxExtension.watch();

    await componentsWebWatched;
    await extensionWatched;
  } else {
    await ctxComponentsWebView.rebuild();
    await ctxComponentsWebView.dispose();
    await ctxExtension.rebuild();
    await ctxExtension.dispose();
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) {
          return;
        }
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
