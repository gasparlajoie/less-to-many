"use strict";

const fs = require("fs");
const path = require("path");
const less = require("less");

// Parse @import statements and register file as a dependent of each imported path
function parseDependencies(file, dependencies)
{
	const content = fs.readFileSync(file, "utf8");
	const dir = path.dirname(file);

	const imports = [...content.matchAll(/@import\s+['"](.+?)['"]/g)]
		.map(m => path.resolve(dir, m[1].endsWith(".less") ? m[1] : m[1] + ".less"));

	imports.forEach(dep =>
	{
		if (!dependencies[dep]) dependencies[dep] = [];
		if (!dependencies[dep].includes(file)) dependencies[dep].push(file);
	});
}

// Recursively crawl a directory and invoke callback for every .less file found
function directoryCrawler(dir, callback)
{
	const files = fs.readdirSync(dir);
	files.forEach(f =>
	{
		const fullPath = path.join(dir, f);
		const stat = fs.statSync(fullPath);
		if (stat.isDirectory())
		{
			directoryCrawler(fullPath, callback);
		}
		else if (f.endsWith(".less"))
		{
			callback(fullPath);
		}
	});
}

// Populate a dependencies map by crawling all .less files under dir
function initDependencies(dir, dependencies)
{
	directoryCrawler(dir, file => parseDependencies(file, dependencies));
}

// Compile a single LESS file to CSS.
// Hooks: onStart(file), onSuccess(outFile), onError(err)
function compileLess(file, { onStart, onSuccess, onError } = {})
{
	if (onStart) onStart(file);
	const outFile = file.replace(/\.less$/, ".css");

	fs.readFile(file, "utf8", (err, data) =>
	{
		if (err)
		{
			if (onError) onError(err); else console.error(err);
			return;
		}
		less.render(data, { filename: file })
			.then(output =>
			{
				fs.writeFileSync(outFile, output.css, "utf8");
				if (onSuccess) onSuccess(outFile);
			})
			.catch(e =>
			{
				if (onError) onError(e); else console.error(e);
			});
	});
}

// Compile file and every file that transitively depends on it.
// compileFn(file) is called for each file to compile.
function compileWithDependents(file, dependencies, compileFn, seen = new Set())
{
	if (seen.has(file)) return;
	seen.add(file);
	compileFn(file);
	if (dependencies[file])
	{
		dependencies[file].forEach(dep => compileWithDependents(dep, dependencies, compileFn, seen));
	}
}

module.exports = {
	parseDependencies,
	directoryCrawler,
	initDependencies,
	compileLess,
	compileWithDependents,
};
