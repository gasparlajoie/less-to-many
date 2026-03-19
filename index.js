#!/usr/bin/env node

/*
 quick hack watcher for less files
*/

const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { program } = require("commander");
const { default: chalk } = require("chalk");
const lib = require("./lib");

program
	.option("-s, --src <dir>", "source directory", "./")
	.option("-o, --once", "compile only once then exit", false)
	.parse(process.argv);

// Options
const options = program.opts();
const srcDir = path.resolve(options.src);
const runOnce = options.once;

// Map to store dependencies
const dependencies = {};
let hasIncludedFilesFromNodeModules = false;
let watcher = null;

// Debounce timers per file
const debounceTimers = {};

// Compile a LESS file with chalk-coloured terminal output
function compileLess(file)
{
	const relativePath = path.relative(srcDir, file);
	lib.compileLess(file, {
		onStart: () => console.log(chalk.bgBlackBright.white(`⏳ Compiling: ${relativePath} ...`)),
		onSuccess: (outFile) => console.log(chalk.bgGreenBright(`...➡️  Compiled: ${path.relative(srcDir, outFile)}`)),
		onError: (e) =>
		{
			console.error(chalk.bgRedBright(`Error compiling ${relativePath}, is it locked? 🔒`));
			console.error(e);
		},
	});
}

// Welcome message
function welcomeMessage(isRunOnce)
{
	console.log(chalk.blue(`=======================================`));
	console.log(chalk.bgBlue.white.bold(`    [ [ Welcome to less-to-many ] ]    `))
	if (isRunOnce) console.log(chalk.blue(`Compiling LESS files in ${srcDir}...`));
	if (!isRunOnce) console.log(chalk.blue(`Watching LESS files in ${srcDir}...`));
	console.log(chalk.blue(`=======================================`));
}


// Start here
if (!fs.existsSync(srcDir))
{
	console.error(chalk.red(`Source directory not found: ${srcDir}`));
	process.exit(1);
}

lib.initDependencies(srcDir, dependencies);
welcomeMessage(runOnce);

if (runOnce)
{
	const fileList = [];
	lib.directoryCrawler(srcDir, file => fileList.push(file));
	console.log(chalk.blue(`Found ${fileList.length} LESS files to compile.`));

	fileList.forEach(file => compileLess(file));
}
else
{
	// Watch files
	watcher = chokidar.watch(`${srcDir}/**/*.less`, {
		persistent: true,
		ignoreInitial: true
	});

	watcher
		.on("change", file =>
		{
			const resolved = path.resolve(file);
			clearTimeout(debounceTimers[resolved]);
			debounceTimers[resolved] = setTimeout(() =>
			{
				console.info(chalk.bgBlackBright(`⏳ ...file changed... ${file}`));
				lib.compileWithDependents(resolved, dependencies, compileLess);
			}, 100);
		})
		.on("add", file =>
		{
			if (file.includes("node_modules"))
			{
				if (!hasIncludedFilesFromNodeModules)
				{
					console.warn(chalk.yellow(`😵‍💫 WAIT! ✋ You are including files from node_modules!:`), chalk.bgCyanBright(file));
					hasIncludedFilesFromNodeModules = true;
				}
				return;
			} else
			{
				console.info(chalk.bgBlack.white(`⏳ ...file added... ${file}`));
				const resolved = path.resolve(file);
				lib.parseDependencies(resolved, dependencies);
			}
		})
		.on("unlink", file =>
		{
			const resolved = path.resolve(file);
			// Remove the deleted file from all dependency arrays
			Object.keys(dependencies).forEach(dep =>
			{
				dependencies[dep] = dependencies[dep].filter(f => f !== resolved);
				if (dependencies[dep].length === 0) delete dependencies[dep];
			});
			// Remove the file's own key if it had dependents registered under it
			delete dependencies[resolved];
		});
}

// Handle graceful exit
process.on("SIGINT", () =>
{
	console.log(" ");
	console.log(chalk.red.bold.underline("Stopping LESS watcher. Bye! 👋"));
	if (watcher) watcher.close();
	process.exit(0);
});
