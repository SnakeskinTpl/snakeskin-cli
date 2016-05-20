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
	babel = require('babel-core'),
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

var
	ssrc = path.join(process.cwd(), '.snakeskinrc');

if (!program['params'] && exists(ssrc)) {
	program['params'] = ssrc;
}

var
	params = Object.assign({}, Snakeskin.toObj(program['params']), {debug: {}, cache: false}),
	prettyPrint = params.prettyPrint,
	language = params.language,
	words = params.words;

var
	include = {},
	fMap = {};

var
	jsx = program['jsx'],
	exec = program['exec'],
	tplData = program['data'],
	mainTpl = program['tpl'],
	watch = program['watch'];

if (jsx) {
	params.literalBounds = ['{', '}'];
	params.renderMode = 'stringConcat';
	exec = false;
}

var
	args = program['args'],
	input;

var
	file = program['source'],
	out = program['output'],
	n = params.eol || '\n';

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
	file = file || program['file'] || '';

	var
		tpls = {},
		fileName = '';

	if (file) {
		fileName = path.basename(file, path.extname(file));
	}

	if (tplData || mainTpl || exec || jsx) {
		params.context = tpls;
		params.prettyPrint = false;
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

	if (language) {
		params.language = load(language);
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

		if (file && (!words || exists(words)) && params.cache !== false) {
			var includes = Snakeskin.check(
				file,
				outFile,
				Snakeskin.compile(null, Object.assign({}, params, {getCacheKey: true})),
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

	var res;
	try {
		res = Snakeskin.compile(
			String(data),
			params,
			{file: file}
		);

	} catch (err) {
		console.log(new Date().toString());
		console.error(err.message);
		res = false;

		if (!watch) {
			process.exit(1);
		}
	}

	var
		toConsole = input && !program['output'] || !outFile;

	if (res !== false) {
		try {
			var dataObj;
			if (tplData && tplData !== true) {
				dataObj = load(tplData);
			}

		} catch (err) {
			console.log(new Date().toString());
			console.error(err.message);
			res = '';

			if (!watch) {
				process.exit(1);
			}
		}

		var compileJSX = function (tpls, prop) {
			try {
				prop = prop || 'exports';
				$C(tpls).forEach(function (el, key) {
					var val = prop + '["' + key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';

					if (typeof el !== 'function') {
						res += 'if (' + val + ' instanceof Object === false) {' + n + '\t' + val + ' = {};' + n + '}' + n + n;
						return compileJSX(el, val);
					}

					var decl = /function .*?\)\s*\{/.exec(el.toString());
					res += babel.transform(val + ' = ' + decl[0] + ' ' + el(dataObj) + '};', {
						babelrc: false,
						plugins: [
							require('babel-plugin-syntax-jsx'),
							require('babel-plugin-transform-react-jsx'),
							require('babel-plugin-transform-react-display-name')
						]
					}).code;
				});

			} catch (err) {
				console.log(new Date().toString());
				console.error(err.message);
				res = '';

				if (!watch) {
					process.exit(1);
				}
			}
		};

		if (jsx) {
			res = '';
			compileJSX(tpls);

		} else if (execTpl) {
			var tpl = Snakeskin.getMainTpl(tpls, fileName, mainTpl);

			if (!tpl) {
				console.log(new Date().toString());
				console.error('Template to run is not defined');
				res = '';

				if (!watch) {
					process.exit(1);
				}

			} else {
				try {
					var cache = res = tpl(dataObj);

					if (prettyPrint) {
						if (toConsole) {
							res = beautify['html'](res);

						} else {
							res = (beautify[path.extname(outFile).replace(/^\./, '')] || beautify['html'])(res);
						}

						if (!res || !res.trim()) {
							res = cache;
						}
					}

				} catch (err) {
					console.log(new Date().toString());
					console.error(err.message);
					res = '';

					if (!watch) {
						process.exit(1);
					}
				}
			}
		}

		if (toConsole) {
			console.log(res);

		} else {
			fs.writeFileSync(outFile, res);
			success();

			var tmp = params.debug.files;

			include[file] = include[file] || {};
			include[file][file] = true;

			if (tmp) {
				$C(tmp).forEach(function (el, key) {
					include[key] = include[key] || {};
					include[key][file] = true;
				});
			}
		}

	} else if (!watch) {
		process.exit(1);
	}
}

function end() {
	if (words) {
		testDir(words);
		fs.writeFileSync(words, JSON.stringify(params.words, null, '\t'));
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
		stdout.write(n);
		stdin.emit('end');
		stdout.write(n);
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
