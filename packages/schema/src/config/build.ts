import { defineUntypedSchema } from 'untyped'
import { defu } from 'defu'
import { join } from 'pathe'
import { isTest } from 'std-env'
import { consola } from 'consola'

export default defineUntypedSchema({
  /**
   * The builder to use for bundling the Vue part of your application.
   * @type {'vite' | 'webpack' | 'rspack' | { bundle: (nuxt: typeof import('../src/types/nuxt').Nuxt) => Promise<void> }}
   */
  builder: {
    $resolve: async (val: 'vite' | 'webpack' | 'rspack' | { bundle: (nuxt: unknown) => Promise<void> } | undefined = 'vite', get) => {
      if (typeof val === 'object') {
        return val
      }
      const map: Record<string, string> = {
        rspack: '@nuxt/rspack-builder',
        vite: '@nuxt/vite-builder',
        webpack: '@nuxt/webpack-builder',
      }
      return map[val] || val || (await get('vite') === false ? map.webpack : map.vite)
    },
  },

  /**
   * Configures whether and how sourcemaps are generated for server and/or client bundles.
   *
   * If set to a single boolean, that value applies to both server and client.
   * Additionally, the `'hidden'` option is also available for both server and client.
   *
   * Available options for both client and server:
   * - `true`: Generates sourcemaps and includes source references in the final bundle.
   * - `false`: Does not generate any sourcemaps.
   * - `'hidden'`: Generates sourcemaps but does not include references in the final bundle.
   *
   * @type {boolean | { server?: boolean | 'hidden', client?: boolean | 'hidden' }}
   */
  sourcemap: {
    $resolve: async (val: boolean | { server?: boolean | 'hidden', client?: boolean | 'hidden' } | undefined, get) => {
      if (typeof val === 'boolean') {
        return { server: val, client: val }
      }
      return defu(val, {
        server: true,
        client: await get('dev'),
      })
    },
  },

  /**
   * Log level when building logs.
   *
   * Defaults to 'silent' when running in CI or when a TTY is not available.
   * This option is then used as 'silent' in Vite and 'none' in Webpack
   * @type {'silent' | 'info' | 'verbose'}
   */
  logLevel: {
    $resolve: (val: string | undefined) => {
      if (val && !['silent', 'info', 'verbose'].includes(val)) {
        consola.warn(`Invalid \`logLevel\` option: \`${val}\`. Must be one of: \`silent\`, \`info\`, \`verbose\`.`)
      }
      return val ?? (isTest ? 'silent' : 'info')
    },
  },

  /**
   * Shared build configuration.
   */
  build: {
    /**
     * If you want to transpile specific dependencies with Babel, you can add them here.
     * Each item in transpile can be a package name, a function, a string or regex object matching the
     * dependency's file name.
     *
     * You can also use a function to conditionally transpile. The function will receive an object ({ isDev, isServer, isClient, isModern, isLegacy }).
     * @example
     * ```js
     * transpile: [({ isLegacy }) => isLegacy && 'ky']
     * ```
     * @type {Array<string | RegExp | ((ctx: { isClient?: boolean; isServer?: boolean; isDev: boolean }) => string | RegExp | false)>}
     */
    transpile: {
      $resolve: (val: Array<string | RegExp | ((ctx: { isClient?: boolean, isServer?: boolean, isDev: boolean }) => string | RegExp | false)> | undefined) => (val || []).filter(Boolean),
    },

    /**
     * It is recommended to use `addTemplate` from `@nuxt/kit` instead of this option.
     *
     * @example
     * ```js
     * templates: [
     *   {
     *     src: '~/modules/support/plugin.js', // `src` can be absolute or relative
     *     dst: 'support.js', // `dst` is relative to project `.nuxt` dir
     *   }
     * ]
     * ```
     * @type {typeof import('../src/types/nuxt').NuxtTemplate<any>[]}
     */
    templates: [],

    /**
     * Nuxt allows visualizing your bundles and how to optimize them.
     *
     * Set to `true` to enable bundle analysis, or pass an object with options: [for webpack](https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin) or [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
     * @example
     * ```js
     * analyze: {
     *   analyzerMode: 'static'
     * }
     * ```
     * @type {boolean | { enabled?: boolean } & ((0 extends 1 & typeof import('webpack-bundle-analyzer').BundleAnalyzerPlugin.Options ? {} : typeof import('webpack-bundle-analyzer').BundleAnalyzerPlugin.Options) | typeof import('rollup-plugin-visualizer').PluginVisualizerOptions)}
     */
    analyze: {
      $resolve: async (val: boolean | { enabled?: boolean } | Record<string, unknown>, get) => {
        const [rootDir, analyzeDir] = await Promise.all([get('rootDir'), get('analyzeDir')]) as [string, string]
        return defu(typeof val === 'boolean' ? { enabled: val } : val, {
          template: 'treemap',
          projectRoot: rootDir,
          filename: join(analyzeDir, '{name}.html'),
        })
      },
    },
  },

  /**
   * Build time optimization configuration.
   */
  optimization: {
    /**
     * Functions to inject a key for.
     *
     * As long as the number of arguments passed to the function is less than `argumentLength`, an
     * additional magic string will be injected that can be used to deduplicate requests between server
     * and client. You will need to take steps to handle this additional key.
     *
     * The key will be unique based on the location of the function being invoked within the file.
     * @type {Array<{ name: string, source?: string | RegExp, argumentLength: number }>}
     */
    keyedComposables: {
      $resolve: (val: Array<{ name: string, argumentLength: string }> | undefined) => [
        { name: 'callOnce', argumentLength: 3 },
        { name: 'defineNuxtComponent', argumentLength: 2 },
        { name: 'useState', argumentLength: 2 },
        { name: 'useFetch', argumentLength: 3 },
        { name: 'useAsyncData', argumentLength: 3 },
        { name: 'useLazyAsyncData', argumentLength: 3 },
        { name: 'useLazyFetch', argumentLength: 3 },
        ...val || [],
      ].filter(Boolean),
    },

    /**
     * Tree shake code from specific builds.
     */
    treeShake: {
      /**
       * Tree shake composables from the server or client builds.
       * @example
       * ```js
       * treeShake: { client: { myPackage: ['useServerOnlyComposable'] } }
       * ```
       */
      composables: {
        server: {
          $resolve: async (val, get) => defu(val || {},
            await get('dev')
              ? {}
              : {
                  'vue': ['onMounted', 'onUpdated', 'onUnmounted', 'onBeforeMount', 'onBeforeUpdate', 'onBeforeUnmount', 'onRenderTracked', 'onRenderTriggered', 'onActivated', 'onDeactivated'],
                  '#app': ['definePayloadReviver', 'definePageMeta'],
                },
          ),
        },
        client: {
          $resolve: async (val, get) => defu(val || {},
            await get('dev')
              ? {}
              : {
                  'vue': ['onRenderTracked', 'onRenderTriggered', 'onServerPrefetch'],
                  '#app': ['definePayloadReducer', 'definePageMeta', 'onPrehydrate'],
                },
          ),
        },
      },
    },

    /**
     * Options passed directly to the transformer from `unctx` that preserves async context
     * after `await`.
     * @type {typeof import('unctx/transform').TransformerOptions}
     */
    asyncTransforms: {
      asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
      objectDefinitions: {
        defineNuxtComponent: ['asyncData', 'setup'],
        defineNuxtPlugin: ['setup'],
        definePageMeta: ['middleware', 'validate'],
      },
    },
  },
})
