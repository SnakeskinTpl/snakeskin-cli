snakeskin-cli
=============

CLI plugin for [Snakeskin](https://github.com/SnakeskinTpl/Snakeskin).

[![NPM version](http://img.shields.io/npm/v/snakeskin-cli.svg?style=flat)](http://badge.fury.io/js/snakeskin-cli)
[![Build Status](http://img.shields.io/travis/SnakeskinTpl/snakeskin-cli.svg?style=flat&branch=master)](https://travis-ci.org/SnakeskinTpl/snakeskin-cli)
[![NPM dependencies](http://img.shields.io/david/SnakeskinTpl/snakeskin-cli.svg?style=flat)](https://david-dm.org/SnakeskinTpl/snakeskin-cli)
[![NPM devDependencies](http://img.shields.io/david/dev/SnakeskinTpl/snakeskin-cli.svg?style=flat)](https://david-dm.org/SnakeskinTpl/snakeskin-cli#info=devDependencies&view=table)

## Install

```bash
npm install snakeskin-cli --global
```

## Usage

```bash
snakeskin [options] [dir|file ...]
```

### options

```bash
-h, --help
-V, --version

-s, --source [src]        path to a template file or a template directory
-p, --params [config]     object with compile parameters or a path to a config file
-o, --output [src]        path to the output file
-w, --watch               watch files for changes and automatically recompile

-m, --mask [mask]         mask for template files (RegExp)
--extname [ext]           file extension for output files (if "output" is a directory)
-f, --file [src]          path to a template file (meta information for the debugger)

-a, --adapter [name]      name of an adaptor, for example: ss2react or ss2vue
--adapterOptions [config] object with adaptor parameters or a path to a config file
-e, --exec                execute compiled templates
-d, --data [src]          data object for execution or a path to a data file
-t, --tpl [name]          name of the main template
```

#### Addition

* If `--output` is a folder, then the result will be saved by the path:

```
--output/%file%(--extname || --exec ? '.html' : '.js')
```

* Parameters `--params language` and `--params words` can be declaring as path to a file.
* If `--params language` is a folder, then a file will be searched by the path:

```
%fileDir%/%fileName%('.js' || '.json')
```

* With parameters `--params language` and `--output` can be used special placeholders:

1. `%fileDir%` — directory name of the source file (absolute path);
2. `%fileName%` — name of the source file without extension;
3. `%file%` — name the source file with extension;
4. `%filePath%` — full path to the source file.

## Examples
### Compiling a text and output to stdout

```bash
snakeskin '{template foo()}hello world{/}'
```

**Or**

```bash
echo '{template foo()}hello world{/}' | snakeskin
```

### Compiling a file with some SS parameters and output to stdout

```bash
snakeskin myFile.ss -p prettyPrint:true,tolerateWhitespaces:true
```

### Compiling a folder and save to an another folder by the specified mask

```bash
snakeskin ./templates -m '\\.main\\.ss$' -o ./compile
```

## [License](https://github.com/SnakeskinTpl/snakeskin-cli/blob/master/LICENSE)

The MIT License.
