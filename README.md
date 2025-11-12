# less-to-many

Small CLI watcher that compiles LESS files to CSS and re-compiles dependents when an imported file changes.

- Entry: [index.js](index.js)  
  Key functions: [`parseDependencies`](index.js), [`initDependencies`](index.js), [`compileLess`](index.js), [`compileWithDependents`](index.js)

## Install

```sh
npm install less-to-many
# or to install globally
npm install -g less-to-many
```

See [package.json](package.json) for the `bin` mapping (`less-watcher`) and scripts.

## Usage

Watch the current directory:

```sh
node index.js
# or
npm start
```

Specify a source directory:
```sh
node index.js -s path/to/src
# or
node index.js --src path/to/src
```

## Behavior
- Scans and records imports via `parseDependencies` and initializes them with `initDependencies`.
- Compiles a changed file with `compileLess` and recursively recompiles dependents via `compileWithDependents`.
- Ignores files in `node_modules` after the first warning.

## Stop
Press `Ctrl+C` to stop the watcher.

## License
Apache 2.0