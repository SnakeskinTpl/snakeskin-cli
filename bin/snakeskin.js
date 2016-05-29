#!/usr/bin/env node

/*!
 * Snakeskin CLI
 * https://github.com/SnakeskinTpl/snakeskin-cli
 *
 * Released under the MIT license
 * https://github.com/SnakeskinTpl/snakeskin-cli/blob/master/LICENSE
 */

require('core-js/es6/object');
global.Snakeskin = require('snakeskin');

var
	$C = require('collection.js').$C;

var
	program = require('commander'),
	beautify = require('js-beautify'),
	monocle = require('monocle')();

var
	path = require('path'),
	fs = require('fs'),
	mkdirp = require('mkdirp'),
	exists = require('exists-sync');

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

	.option('--jsx', 'convert templates for using with React')
	.option('-e, --exec', 'execute compiled templates')
	.option('-d, --data [src]', 'data object for execution or a path to a data file')
	.option('-t, --tpl [name]', 'name of the main template')

	.parse(process.argv);

var ssrc = path.join(process.cwd(), '.snakeskinrc');
if (!program['params'] && exists(ssrc)) {
	program['params'] = ssrc;
}

var
	p = Object.assign({eol: '\n'}, Snakeskin.toObj(program['params']), {debug: {}});

var
	prettyPrint = p.prettyPrint,
	language = p.language,
	words = p.words;

if (typeof words === 'string') {
	p.words = {};
}

var
	eol = p.eol,
	nRgxp = /\r?\n|\r/g;

var
	include = {},
	fMap = {};

var
	jsx = program['jsx'],
	exec = program['exec'],
	tplData = program['data'],
	mainTpl = program['tpl'],
	watch = program['watch'];

var
	args = program['args'],
	input;

var
	file = program['source'],
	out = program['output'];

if (!file && args.length) {
	input = args.join(' ');

	if (exists(input)) {
		file = input;
		input = false;
	}
}

var
	calls = {},
	root = '';

function action(data, file) {
	console.time('Time');
	data = String(data);
	file = file || program['file'] || '';

	var
		tpls = {},
		fileName = '';

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
		var tmp = val = pathTpl(val);
		val = path.normalize(path.resolve(val));

		if (fileName && exists(val) && fs.statSync(val).isDirectory()) {
			tmp = path.join(val, fileName) + '.js';

			if (!exists(tmp)) {
				tmp += 'on';
			}
		}

		return Snakeskin.toObj(tmp, null, function (src) {
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
		console.log('File "' + url(file) + '" was successfully compiled -> "' + url(outFile) + '".');
		console.timeEnd('Time');
		line();
	}

	var
		outFile = out,
		execTpl = tplData || mainTpl || exec;

	if (outFile) {
		outFile = path.normalize(path.resolve(pathTpl(outFile)));
		testDir(outFile);

		if (exists(outFile) && fs.statSync(outFile).isDirectory()) {
			outFile = path.join(outFile, path.relative(root, path.dirname(file)), fileName) +
				(program['extname'] || (execTpl ? '.html' : '.js'));

			testDir(outFile);
		}

		if (file && (!words || exists(words)) && p.cache !== false) {
			var includes = Snakeskin.check(
				file,
				outFile,
				Snakeskin.compile(null, Object.assign({}, p, {getCacheKey: true})),
				true
			);

			if (includes) {
				success();

				include[file] = include[file] || {};
				include[file][file] = true;

				$C(includes).forEach(function (key) {
					include[key] = include[key] || {};
					include[key][file] = true;
				});

				return;
			}
		}
	}

	var
		toConsole = input && !program['output'] || !outFile,
		res;

	try {
		var dataObj;
		if (tplData && tplData !== true) {
			p.data = dataObj = load(tplData);
		}

		if (jsx) {
			res = Snakeskin.compileAsJSX(data, p, {file: file});

		} else {
			res = Snakeskin.compile(data, p, {file: file});

			if (res && execTpl) {
				var tpl = Snakeskin.getMainTpl(tpls, fileName, mainTpl);

				if (!tpl) {
					console.log(new Date().toString());
					console.error('Template to run is not defined');
					res = '';

					if (!watch) {
						process.exit(1);
					}

				} else {
					var cache = res = tpl(dataObj);

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

					res = res.replace(nRgxp, eol) + eol;
				}
			}
		}

	} catch (err) {
		console.log(new Date().toString());
		console.error('Error: ' + err.message);
		res = false;
		if (!watch) {
			process.exit(1);
		}
	}

	if (typeof res === 'string') {
		if (toConsole) {
			console.log(res);

		} else {
			fs.writeFileSync(outFile, res);
			success();

			var tmp = p.debug.files;

			include[file] = include[file] || {};
			include[file][file] = true;

			if (tmp) {
				$C(tmp).forEach(function (el, key) {
					include[key] = include[key] || {};
					include[key][file] = true;
				});
			}
		}
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
	var buf = '';

	var
		stdin = process.stdin,
		stdout = process.stdout;

	stdin.setEncoding('utf8');
	stdin.on('data', function (chunk) {
		buf += chunk;
	});

	stdin.on('end', function () {
		action(buf);
		end();
	}).resume();

	process.on('SIGINT', function () {
		stdout.write(eol);
		stdin.emit('end');
		stdout.write(eol);
		process.exit();
	});

} else {
	if (file) {
		file = path.normalize(path.resolve(file));

		var
			isDir = fs.statSync(file).isDirectory(),
			mask = program['mask'] && new RegExp(program['mask']);

		var watchDir = function () {
			monocle.watchDirectory({
				root: file,
				listener: function (f) {
					var src = f.fullPath;

					if (
						!fMap[src] && exists(src) && !f.stat.isDirectory() &&
						(mask ? mask.test(src) : path.extname(src) === '.ss')

					) {
						monocle.unwatchAll();
						console.log(file);
						action(fs.readFileSync(src), src, file);
						watchFiles();
					}
				}
			});
		};

		var watchFiles = function watchFiles() {
			var files = [];

			$C(include).forEach(function (el, key) {
				fMap[key] = true;
				files.push(key);
			});

			monocle.watchFiles({
				files: files,
				listener: function (f) {
					var
						src = f.fullPath,
						files = include[src];

					if (files && !calls[src]) {
						calls[src] = setTimeout(function () {
							monocle.unwatchAll();

							$C(files).forEach(function (el, key) {
								if ((!mask || mask.test(key))) {
									if (exists(key)) {
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
			var renderDir = function (dir) {
				$C(fs.readdirSync(dir)).forEach(function (el) {
					var src = path.join(dir, el);

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
