#!/usr/bin/env node

/*
 quick hack watcher for less files
*/

const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { program } = require("commander");
const less = require("less");
const { default: chalk } = require("chalk");

program
	.option("-s, --src <dir>", "source directory", "./")
	.parse(process.argv);

const options = program.opts();
const srcDir = path.resolve(options.src);

// Map to store dependencies
const dependencies = {};

// Parse @import statements for dependency tracking
function parseDependencies(file) {
	const content = fs.readFileSync(file, "utf8");
	const dir = path.dirname(file);
	
	const imports = [...content.matchAll(/@import\s+['"](.+?)['"]/g)]
		.map(m => path.resolve(dir, m[1].endsWith(".less") ? m[1] : m[1] + ".less")
	);

	imports.forEach(dep => {
		if (!dependencies[dep]) dependencies[dep] = [];
		if (!dependencies[dep].includes(file)) dependencies[dep].push(file);
	});
}

// Compile LESS file
function compileLess(file) {
	const relativePath = path.relative(srcDir, file);
	const outFile = file.replace(/\.less$/, ".css");

	fs.readFile(file, "utf8", (err, data) => {
		if (err) return console.error(err);
		less.render(data, { filename: file })
			.then(output => {
				fs.writeFileSync(outFile, output.css, "utf8");
				console.log(chalk.bgGreenBright(`...➡️  Compiled: ${path.relative(srcDir, outFile)}`));
			})
			.catch(e => {
				console.error(chalk.bgRedBright(`Error compiling ${relativePath}, is it locked? 🔒`));
				console.error(e);
			});
	});
}

// Recursively compile dependents
function compileWithDependents(file, seen = new Set()) {
	if (seen.has(file)) return;
	seen.add(file);
	compileLess(file);
	if (dependencies[file]) {
		dependencies[file].forEach(dep => compileWithDependents(dep, seen));
	}
}

// Initialize dependencies
function initDependencies(dir) {
	const files = fs.readdirSync(dir);
	files.forEach(f => {
		const fullPath = path.join(dir, f);
		const stat = fs.statSync(fullPath);
		if (stat.isDirectory()) initDependencies(fullPath);
		else if (f.endsWith(".less")) parseDependencies(fullPath);
	});
}

initDependencies(srcDir);

// Watch files
const watcher = chokidar.watch(`${srcDir}/**/*.less`, {
	persistent: true,
	ignoreInitial: false
});

let hasIncludedFilesFromNodeModules = false;

watcher
	.on("change", file => {
		console.info(chalk.bgBlackBright(`⏳ ...file changed... ${file}`));
		compileWithDependents(path.resolve(file))
	})
	.on("add", file => {
		if (file.includes("node_modules")) {
			if (!hasIncludedFilesFromNodeModules)
			{
				console.warn(chalk.yellow(`😵‍💫 WAIT! ✋ You are including files from node_modules!:`), chalk.bgCyanBright(file));
				hasIncludedFilesFromNodeModules = true;
			}
			return;
		} else {
			console.info(chalk.bgBlack.white(`⏳ ...file added... ${file}`));
			const resolved = path.resolve(file);
			parseDependencies(resolved);
		}
	});

	process.on("SIGINT", () => {
	console.log(" ");
	console.log(chalk.red.bold.underline("Stopping LESS watcher. Bye! 👋"));
	watcher.close().then(() => process.exit(0));
});


console.log(chalk.blue(`=======================================`));
console.log(chalk.bgBlue.white.bold(`    [ [ Welcome to less-to-many ] ]    `))
console.log(chalk.blue(`Watching LESS files in ${srcDir}...`));
console.log(chalk.blue(`=======================================`));
