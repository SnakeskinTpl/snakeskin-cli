snakeskin-cli
=============

CLI plugin for Snakeskin.

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

-s, --source [src]       путь к файлу или папке шаблонов
-m, --mask [mask]        маска для файлов шаблонов (RegExp)

-f, --file [src]         путь к файлу шаблонов (метаинформация для отладчика)
-p, --params [src]       путь к файлу с параметрами для запуска
                         или сами параметры

-o, --output [src]       путь к файлу или папке для сохранения результата
--extname [ext]          формат сохраняемого файла
                         (если --output задан папкой)

--exports                тип экспорта шаблонов
--render-as              тип рендеринга шаблонов (placeholder, interface)

-e, --exec               выполнить скомпилированный шаблон
-d, --data [src]         путь к файлу или папке с данными для запуска
                         или сами данные
-t, --tpl [name]         имя запускаемого шаблона

--disable-localization   отключить поддержку локализации
--i18n-fn                название i18n функции
--language [src]         путь к файлу или папке с данными для локализации
                         или сами данные
--words [src]            путь к файлу для сохранения найденных фраз
                         для локализации

--auto-replace           включить поддержку макросов
--macros [src]           путь к файлу или папке с макросами или сами макросы

--disable-use-strict     отключить режим 'use strict';
--bem-filter             название используемого фильтра для БЭМ
--line-separator         символ новой строки (\n, \r или \r\n)
--tolerate-whitespace    не обрабатывать пробельные символы в шаблонах
--ignore                 пробельные символы для игнорирования
                         в шаблонах (RegExp)

--doctype                тип xml документа (xml, html или false)
--render-mode            режим рендеринга шаблонов (stringConcat,
                         stringBuffer, dom)
--inline-iterators       инлайнить итераторы forEach и forIn с помощью циклов

--disable-replace-undef  отключить базовый фильтр "undef"
--disable-escape-output  отключить базовый фильтр "html"

--pretty-print           форматировать вывод
--watch                  автоматически перекомпилировать изменения
```

#### Дополнение

* Если `--output` задан папкой, то результат будет сохранятся по пути:

```
--output/%file%(--extname || --exec ? '.html' : '.js')
```

* Если `--macros` или `--language` заданы папкой, то данные будут искаться по пути:

```
%fileDir%/%fileName%('.js' || '.json')
```

* В параметрах `--macros`, `--language`, `--output` можно использовать специальные слова:

1. `%fileDir%` — директория исходного файла (абсолютный путь);
2. `%fileName%` — имя исходного файла (без расширения);
3. `%file%` — имя исходного файла (с расширением);
4. `%filePath%` — полный путь к исходному файлу.

* При указании регулярного выражения для `--mask` или `--ignore` необходимо экранировать обратный слеш.

## Примеры

**Компиляция текста с выводом результата в консоль**

```bash
snakeskin '{template foo()}hello world{/}'
```

Или поверх `stdio`

```bash
echo '{template foo()}hello world{/}' | snakeskin
```

**Компиляция файла с выводом результата в консоль**

```bash
snakeskin myFile.ss
```

**Компиляция папки по маске с сохранением в другую папку**

```bash
snakeskin ./templates -m '\\.main\\.ss$' -o ./compile
```


**Компиляция файла для node.js с сохранением**

```bash
snakeskin myFile.ss -o myFile.ss.js -n
```

Или поверх `stdio`

```bash
snakeskin < myFile.ss -n > myFile.ss.js
```

