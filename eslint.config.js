module.exports = [
  {
    ignores: [
      "node_modules/**",
      "public/**",
      "data/**",
      "coverage/**",
      "package-lock.json",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        URL: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-unreachable": "error",
      "no-duplicate-imports": "error",
    },
  },
];
