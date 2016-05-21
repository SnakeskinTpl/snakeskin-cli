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

var ssrc = path.join(process.cwd(), '.snakeskinrc');
if (!program['params'] && exists(ssrc)) {
	program['params'] = ssrc;
}

var p = Object.assign(
	{
		module: 'umd',
		moduleId: 'tpls',
		useStrict: true,
		eol: '\n'
	},

	Snakeskin.toObj(program['params']), {debug: {}, cache: false}
);

var
	prettyPrint = p.prettyPrint,
	language = p.language,
	words = p.words;

var
	useStrict = p.useStrict ? '"useStrict";' : '',
	mod = p.module,
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

if (jsx) {
	p.literalBounds = ['{', '}'];
	p.renderMode = 'stringConcat';
	p.doctype = 'strict';
	exec = false;
}

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
	file = file || program['file'] || '';

	var
		tpls = {},
		fileName = '';

	if (file) {
		fileName = path.basename(file, path.extname(file));
	}

	if (tplData || mainTpl || exec || jsx) {
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

	if (language) {
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

	var res;
	function fail(err, val) {
		console.log(new Date().toString());
		console.error(err.message);
		res = val;
		if (!watch) {
			process.exit(1);
		}
	}

	try {
		res = Snakeskin.compile(String(data), p, {file: file});

	} catch (err) {
		fail(err, false);
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
			fail(err, '');
		}

		var testId = function (id) {
			try {
				var obj = {};
				eval('obj.' + id + '= true');
				return true;

			} catch (ignore) {
				return false;
			}
		};

		var compileJSX = function (tpls, prop) {
			prop = prop || 'exports';
			$C(tpls).forEach(function (el, key) {
				var
					val,
					validKey = false;

				if (testId(key)) {
					val = prop + '.' + key;
					validKey = true;

				} else {
					val = prop + '["' + key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
				}

				if (typeof el !== 'function') {
					res +=
						'if (' + val + ' instanceof Object === false) {' +
							val + ' = {};' +
							(validKey && mod === 'native' ? 'export var ' + key + '=' + val + ';' : '') +
						'}'
					;

					return compileJSX(el, val);
				}

				var
					decl = /function .*?\)\s*\{/.exec(el.toString()),
					text = el(dataObj);

				text = val + ' = ' + decl[0] + (/\breturn\s+\(?\s*[{<](?!\/)/.test(text) ? '' : 'return ') + text + '};';
				res += babel.transform(text, {
					babelrc: false,
					plugins: [
						require('babel-plugin-syntax-jsx'),
						require('babel-plugin-transform-react-jsx'),
						require('babel-plugin-transform-react-display-name')
					]
				}).code;
			});
		};

		if (jsx) {
			res = /\/\*[\s\S]*?\*\//.exec(res)[0];

			if (mod === 'native') {
				res +=
					useStrict +
					'import React from "react";' +
					'var exports = {};' +
					'export default exports;'
				;

			} else {
				res +=
					'(function(global, factory) {' +
						(
							{cjs: true, umd: true}[mod] ?
								'if (typeof exports === "object" && typeof module !== "undefined") {' +
									'factory(exports, typeof React === "undefined" ? require("react") : React);' +
									'return;' +
								'}' :
								''
						) +

						(
							{amd: true, umd: true}[mod] ?
								'if (typeof define === "function" && define.amd) {' +
									'define("' + (p.moduleId) + '", ["exports", "react"], factory);' +
									'return;' +
								'}' :
								''
						) +

						(
							{global: true, umd: true}[mod] ?
								'factory(global' + (p.moduleName ? '.' + p.moduleName + '= {}' : '') + ', React);' :
								''
						) +

					'})(this, function (exports, React) {' +
						useStrict
				;
			}

			try {
				compileJSX(tpls);
				if (mod !== 'native') {
					res += '});';
				}

				if (prettyPrint) {
					res = beautify.js(res);
				}

				res = res.replace(nRgxp, eol) + eol;

			} catch (err) {
				fail(err, '');
			}

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
							res = beautify.html(res);

						} else {
							res = (beautify[path.extname(outFile).replace(/^\./, '')] || beautify.html)(res);
						}

						if (!res || !res.trim()) {
							res = cache;
						}
					}

					res = res.replace(nRgxp, eol) + eol;

				} catch (err) {
					fail(err, '');
				}
			}
		}

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

	} else if (!watch) {
		process.exit(1);
	}
}

function end() {
	if (words) {
		testDir(words);
		fs.writeFileSync(words, JSON.stringify(p.words, null, '\t'));
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
