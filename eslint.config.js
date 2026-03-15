import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  ...pluginVue.configs['flat/recommended'],
  eslintConfigPrettier,
  {
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 'latest',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
]
