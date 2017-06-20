#!/usr/bin/env node

'use strict';

/*!
 * Snakeskin CLI
 * https://github.com/SnakeskinTpl/snakeskin-cli
 *
 * Released under the MIT license
 * https://github.com/SnakeskinTpl/snakeskin-cli/blob/master/LICENSE
 */

global.Snakeskin = require('snakeskin');

const
	$C = require('collection.js/compiled');

const
	program = require('commander'),
	beautify = require('js-beautify'),
	monocle = require('monocle')();

const
	fs = require('fs'),
	path = require('path'),
	mkdirp = require('mkdirp');

program
	.version(Snakeskin.VERSION.join('.'))

	.usage('[options] [dir|file ...]')

	.option('-s, --source [src]', 'path to a template file or a template directory')
	.option('-p, --params [config]', 'object with compile parameters or a path to a config file')
	.option('-o, --output [src]', 'path to the output file')
	.option('-w, --watch', 'watch files for changes and automatically recompile')

	.option('-m, --mask [mask]', 'mask for template files (RegExp)')
	.option('--extname [ext]', 'file extension for output files (if "output" is a directory)')
	.option('-f, --file [src]', 'path to a template file (meta information for the debugger)')

	.option('--jsx')
	.option('-a, --adapter [name]', 'name of an adaptor, for example: ss2react or ss2vue')
	.option('--adapterOptions [config]', 'object with adaptor parameters or a path to a config file')

	.option('-e, --exec', 'execute compiled templates')
	.option('-d, --data [src]', 'data object for execution or a path to a data file')
	.option('-t, --tpl [name]', 'name of the main template')

	.parse(process.argv);

const
	src = path.join(process.cwd(), '.snakeskinrc');

if (!program['params'] && fs.existsSync(src)) {
	program['params'] = src;
}

const
	p = Object.assign({eol: '\n'}, Snakeskin.toObj(program['params']), {debug: {}});

const
	prettyPrint = p.prettyPrint,
	language = p.language,
	words = p.words;

if (typeof words === 'string') {
	p.words = {};
}

const
	eol = p.eol,
	nRgxp = /\r?\n|\r/g;

const
	include = {},
	fMap = {},
	calls = {};

const
	jsx = program['jsx'],
	adapter = program['adapter'],
	adapterOptions = Snakeskin.toObj(program['adapterOptions']) || {};

const
	exec = program['exec'],
	tplData = program['data'],
	mainTpl = program['tpl'],
	watch = program['watch'],
	args = program['args'],
	out = program['output'];

let
	file = program['source'],
	input;

if (!file && args.length) {
	input = args.join(' ');

	if (fs.existsSync(input)) {
		file = input;
		input = false;
	}
}

let root = '';
function action(data, file) {
	console.time('Time');
	data = String(data);
	file = file || program['file'] || '';

	const
		tpls = {},
		info = {file};

	let fileName = '';
	if (file) {
		fileName = path.basename(file, path.extname(file));
	}

	if (tplData || mainTpl || exec) {
		p.module = 'cjs';
		p.context = tpls;
		p.prettyPrint = false;
	}

	function pathTpl(src) {
		return src
			.replace(/%fileDir%/g, path.dirname(file))
			.replace(/%fileName%/g, fileName)
			.replace(/%file%/g, path.basename(file))
			.replace(/%filePath%/g, file);
	}

	function load(val) {
		let tmp = val = pathTpl(val);
		val = path.normalize(path.resolve(val));

		if (fileName && fs.existsSync(val) && fs.statSync(val).isDirectory()) {
			tmp = `${path.join(val, fileName)}.js`;

			if (!fs.existsSync(tmp)) {
				tmp += 'on';
			}
		}

		return Snakeskin.toObj(tmp, null, (src) => {
			if (file) {
				include[src] = include[src] || {};
				include[src][file] = true;
			}
		});
	}

	if (typeof language === 'string') {
		p.language = load(language);
	}

	function url(url) {
		return path.relative(process.cwd(), path.resolve(url));
	}

	function line() {
		console.log(new Array(80).join('~'));
	}

	function success() {
		line();
		console.log(new Date().toString());
		/* eslint-disable no-use-before-define */
		console.log(`File "${url(file)}" was successfully compiled -> "${url(outFile)}".`);
		/* eslint-enable no-use-before-define */
		console.timeEnd('Time');
		line();
	}

	const
		execTpl = tplData || mainTpl || exec;

	let outFile = out;
	if (outFile) {
		outFile = path.normalize(path.resolve(pathTpl(outFile)));
		testDir(outFile);

		if (fs.existsSync(outFile) && fs.statSync(outFile).isDirectory()) {
			outFile = path.join(outFile, path.relative(root, path.dirname(file)), fileName) +
				(program['extname'] || (execTpl ? '.html' : '.js'));

			testDir(outFile);
		}

		if (file && (!words || fs.existsSync(words)) && p.cache !== false) {
			const includes = Snakeskin.check(
				file,
				outFile,
				Snakeskin.compile(null, Object.assign({}, p, {getCacheKey: true})),
				true
			);

			if (includes) {
				success();

				include[file] = include[file] || {};
				include[file][file] = true;

				$C(includes).forEach((key) => {
					include[key] = include[key] || {};
					include[key][file] = true;
				});

				return;
			}
		}
	}

	function cb(err, res) {
		if (err) {
			console.log(new Date().toString());
			console.error(`Error: ${err.message}`);
			res = false;
			if (!watch) {
				process.exit(1);
			}
		}

		if (typeof res === 'string') {
			/* eslint-disable no-use-before-define */
			if (toConsole) {
			/* eslint-enable no-use-before-define */

				console.log(res);

			} else {
				fs.writeFileSync(outFile, res);
				success();

				const
					tmp = p.debug.files;

				include[file] = include[file] || {};
				include[file][file] = true;

				if (tmp) {
					$C(tmp).forEach((el, key) => {
						include[key] = include[key] || {};
						include[key][file] = true;
					});
				}
			}
		}
	}

	const
		toConsole = input && !program['output'] || !outFile;

	try {
		let dataObj;
		if (tplData && tplData !== true) {
			p.data = dataObj = load(tplData);
		}

		if (jsx || adapter) {
			return require(jsx ? 'ss2react' : adapter).adapter(data, Object.assign({adapterOptions}, p), info).then(
				(res) => {
					cb(null, res);
				},

				cb
			);
		}

		let
			res = Snakeskin.compile(data, p, info);

		if (res && execTpl) {
			const
				tpl = Snakeskin.getMainTpl(tpls, fileName, mainTpl);

			if (!tpl) {
				console.log(new Date().toString());
				console.error('Template to run is not defined');
				res = '';

				if (!watch) {
					process.exit(1);
				}

			} else {
				return Snakeskin.execTpl(tpl, dataObj).then(
					(res) => {
						const
							cache = res;

						if (prettyPrint) {
							if (toConsole) {
								res = beautify.html(res);

							} else {
								res = (beautify[path.extname(outFile).replace(/^\./, '')] || beautify.html)(res);
							}

							if (!res || !res.trim()) {
								res = cache;
							}
						}

						cb(null, res.replace(nRgxp, eol) + eol);
					},

					cb
				);
			}
		}

		cb(null, res);

	} catch (err) {
		cb(err);
	}
}

function end() {
	if (words) {
		testDir(words);
		fs.writeFileSync(words, JSON.stringify(p.words, null, '  '));
	}
}

function testDir(src) {
	src = path.normalize(path.resolve(src));
	mkdirp.sync(path.extname(src) ? path.dirname(src) : src);
}

if (!file && input == null) {
	let buf = '';

	const
		stdin = process.stdin,
		stdout = process.stdout;

	stdin.setEncoding('utf8');
	stdin.on('data', (chunk) => {
		buf += chunk;
	});

	stdin.on('end', () => {
		action(buf);
		end();
	}).resume();

	process.on('SIGINT', () => {
		stdout.write(eol);
		stdin.emit('end');
		stdout.write(eol);
		process.exit();
	});

} else {
	if (file) {
		file = path.normalize(path.resolve(file));

		const
			isDir = fs.statSync(file).isDirectory(),
			mask = program['mask'] && new RegExp(program['mask']);

		const watchDir = () => {
			monocle.watchDirectory({
				root: file,
				listener(f) {
					const
						src = f.fullPath;

					if (
						!fMap[src] && fs.existsSync(src) && !f.stat.isDirectory() &&
						(mask ? mask.test(src) : path.extname(src) === '.ss')

					) {
						monocle.unwatchAll();
						console.log(file);
						action(fs.readFileSync(src), src, file);
						/* eslint-disable no-use-before-define */
						watchFiles();
						/* eslint-enable no-use-before-define */
					}
				}
			});
		};

		const watchFiles = function watchFiles() {
			const
				files = [];

			$C(include).forEach((el, key) => {
				fMap[key] = true;
				files.push(key);
			});

			monocle.watchFiles({
				files,
				listener(f) {
					const
						src = f.fullPath,
						files = include[src];

					if (files && !calls[src]) {
						calls[src] = setTimeout(() => {
							monocle.unwatchAll();

							$C(files).forEach((el, key) => {
								if (!mask || mask.test(key)) {
									if (fs.existsSync(key)) {
										action(fs.readFileSync(key), key);

									} else {
										delete include[key];
										delete fMap[key];
									}
								}
							});

							delete calls[src];
							watchFiles();
						}, 60);
					}

					end();
				}
			});

			if (isDir) {
				watchDir();
			}
		};

		if (fs.statSync(file).isDirectory()) {
			const renderDir = (dir) => {
				$C(fs.readdirSync(dir)).forEach((el) => {
					const
						src = path.join(dir, el);

					if (fs.statSync(src).isDirectory()) {
						renderDir(src);

					} else if (mask ? mask.test(src) : path.extname(el) === '.ss') {
						action(fs.readFileSync(src), src);
					}
				});
			};

			root = file;
			renderDir(file);

		} else if (!mask || mask.test(file)) {
			action(fs.readFileSync(file), file);
		}

		if (watch) {
			watchFiles();
		}

	} else {
		action(input);
	}

	end();
}
