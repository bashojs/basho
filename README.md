# Bashō: Shell Automation with Plain JavaScript

Bashō lets you to write complex shell tasks using plain JavaScript. It mixes well with shell commands and scripts; so you can choose the best tool for the job.

Install Bashō first. Requires node 14 or above.

```bash
npm install -g basho
```

You can use the npx command to try basho without installing.

```bash
# For example, Prints 100
npx basho -j 100
```

## Basics

Bashō evaluates a pipeline of instructions left to right. Instructions can be JavaScript code, reference to an external JS file, or a shell command. What makes basho interesting is [Lazy Evaluation](https://en.wikipedia.org/wiki/Lazy_evaluation), more on this later.

To evaluate a JavaScript expression, use the 'js' option -j. Let’s start with a single item in the pipeline, a JavaScript constant.

```bash
# Prints 100
basho -j 100

# Prints true
basho -j true

# Prints 100
basho -j 10**2
```

The option -j can be omitted for the first expression.

```bash
# This prints 100 too
basho 100

# Prints 100
basho 10**2
```

The option -p avoids printing the final result. This is rarely used, but it is sometimes useful along with the error() function described later.

```bash
# Prints nothing
basho -p 100
```

Working with strings will need quoting, since bash will chew the quotes for itself. So you’ll need to use single quotes around your double quotes.

```bash
# Prints hello, world
basho '"hello, world"'
```

## Piping Results

You can pipe an expression into a subsequent expression. The variable ‘x’ is always used as a placeholder for receiving the previous input.

```bash
# Prints 10100
basho 100 -j x**2 -j x+100
```

## Quoting expressions

If an expression has spaces, it is important to quote it. In the following example, see how 'x + 100' is quoted.

```bash
# Prints 10100
basho 100 -j 'x**2' -j 'x + 100'
```

Similarly, if an expression contains bash special characters it is necessary to quote them. In the following example, the expression is quotes since '>' is the bash redirection operator.

```bash
# Prints 1
basho 100 -j 'x**2' -j 'x>100?1:2'
```

As a best practice, it is wise to quote all expressions (except maybe the trivially simple).

## Lazy evaluation and exit conditions

You may choose to terminate the pipeline with the 'terminate' option -t when a condition is met. Since the pipeline is lazy, further expressions (or bash commands) are not evaluated.

```bash
# Prints 10 and 20. The rest are never evaluated.
basho [1,2,3,4,5] -t 'x>2' -j 'x*10'
```

## Shell Commands

Execute shell commands with the 'execute' option -e. The shell command is expanded as a JS template string, with the variable ‘x’ holding the input from the preceding command in the pipeline. Remember to quote or escape characters which hold a special meaning in your shell, such as \$, >, <, |, () etc.

Tip: Single quotes are far easier to work with, since double quotes will try to
expand \$variables inside it.

```bash
# Prints 1000.
basho 1000 -e 'echo ${x}'
```

You can extend the pipeline further after a shell command. The shell command’s output becomes the input for the next command.

```bash
# echo 110 - which is (10^2) + 10
basho 10 -j 'x**2' -e 'echo ${x}' -j 'parseInt(x)+10' -e 'echo ${x}'
```

basho can receive input via stdin. As always, ‘x’ represents the input.

```bash
# Prints 100
echo 10 | basho 'parseInt(x)**2'
```

You can pipe multi-line output from other commands.

```bash
# Find all files and directories with the string 'git' in its name.
ls -al | basho -f 'x.includes("git")'
```

There’s nothing stopping you from piping basho's output either.

```bash
# Prints 100
basho 10 -j 'x**2' | xargs echo
```

## Importing JS files

You can require a node module with the -i (or --import) option. The -i option takes two parameters; a module name or filename and an alias for the import. 
An import is available in all subsequent expressions.

```bash
# import a module from the node standard lib.
basho -i fs fs -j 'fs.readFileSync("/some/path/to/file")'

# cat square.js
module.exports = function square(n) { return n ** 2; }

# prints 100. Imports square.js as sqr.
basho 10 -i square.js sqr -j 'sqr(x)'

# Prints 40000. Does sqr(10), then adds 100, then sqr(200)
basho 10 -i square.js sqr -j 'sqr(x)' -j 'x+100' -j 'sqr(x)'
```

The -i option imports the default export from a file or module. If you want to use a named export, use the --named-import option.

Let's say you have the following file.

```bash
# cat square.js
export function squareit(n) { return n ** 2; }
```

Since it's not the default export, you'll need to use --named-import.

```bash
basho -i square.js squareit sqr -j 'sqr(x)'
```

## Bundled modules

Basho bundles a few modules for convenience, so that you can import them without having to install via npm.

These modules are currently bundled. For detailed usage, check their documentation.

1. [js-yaml](https://github.com/nodeca/js-yaml)
2. [toml](https://github.com/BinaryMuse/toml-node)
3. [node-fetch](https://github.com/node-fetch/node-fetch)


Using js-yaml:

```bash
# Prints the name property in parsed yaml
cat some.yaml | basho --str -i js-yaml yaml -j 'yaml.load(x)' -j x.name
```

Using toml:

```bash
# Prints the name property in parsed toml
cat some.toml | basho --str -i toml toml -j 'toml.parse(x)' -j x.name
```

Using node-fetch

```bash
# Fetches data from a url
basho -i node-fetch fetch -j 'fetch("http://oaks.nvg.org/basho.html")' -j 'x.status'
```


## Arrays, map, filter, flatMap and reduce

If the input to an expression is an array, the subsequent expression or command is executed for each item in the array. It's the equivalent of a map() function.

```bash
# echo 1; echo 2; echo 3; echo 4
basho [1,2,3,4] -e 'echo ${x}'
```

An input can also be an object, which you can expand in the template string.

```bash
basho '{ name: "jes", age: 100 }' -e 'echo ${x.name}, ${x.age}'
```

You can use an Array of objects.

```bash
# echo kai; echo niki
basho '[{name:"kai"}, {name: "niki"}]' -e 'echo ${x.name}'
```

Array of arrays, sure.

```bash
# echo 1 2 3; echo 3 4 5
basho '[[1,2,3], [3,4,5]]' -e 'echo ${x[0]} ${x[1]} ${x[2]}'
```

If the input is an array, basho processes each item one-by-one (like a map() function). But sometimes, you want to process the entire array at once. Use the -a option for this.

```bash
# echo 4
basho [1,2,3,4] -a -j x.length -e 'echo ${x}'
```

Filter arrays with the 'filter' option -f.

```bash
# echo 3; echo 4
basho [1,2,3,4] -f 'x>2' -e 'echo ${x}'
```

Reduce with the 'reduce' option -r. The first parameter is the lambda, the second parameter is the initial value of the accumulator.

```bash
# Prints the sum 10
basho [1,2,3,4] -r 'acc+x' 0 -e 'echo ${x}'
```

There's also the 'flatMap' option -m.

```bash
# Returns [11, 21, 12, 22, 13, 23]
basho [1,2,3] -m '[x+10,x+20]'
```

A flatMap can be used to flatten an array of arrays as well.

```bash
# Returns 1, 2, 3, 4
basho [[1,2],[2,3]] -m x
```

Btw, you could also access an array index in the template literal as the
variable ‘i’ in lambdas and shell command templates.

```bash
# echo a1; echo b2; echo c3
basho '["a", "b", "c"]' -e 'echo ${x}${i}'
```

## Arguments and Reusable Expressions

Sometimes you want to pass additional arguments or reuse an expression multiple times in the pipeline. You can define expressions with the 'define' option -d and they get stored as fields in a variable named 'k'. See usage below.

Here's how to use the define option to pass arguments

```bash
# Prints 200
basho -d divisor 100 -j '20000/k.divisor'
```

Here's how to use it for reusable expressions.

```bash
# Prints 11, 12, 13
basho [10,11,12] -d add1 'x=>x+1' -j 'k.add1(x)'
```

Can be used in shell commands as well. Remember to quote though.

```bash
# Same as echo 10; echo 11; echo 12
basho [10,11,12] -d ECHO_CMD '"echo"' -e '${k.ECHO_CMD} N${x}'
```

## Subroutines

Subroutines are mini-pipelines within a parent pipeline. This allows us to define a set of operations which could be repeatedly called for each item.

Subroutines are defined with the --sub option followed by the name of the sub. The sub continues till an --endsub is found. The sub is stored for subsequent usage is the variable 'k'.

```bash
# Multiplies by 200
basho [10,11,12] --sub multiply 'x*10' -j 'x*20' --endsub -j 'k.multiply(x)'
```

Nested Subroutines? Sure.

```bash
# Nested Subroutines
basho [10,11,12] \
  --sub multiply \
    --sub square 'x*x' --endsub \
    -j 'x*10' -j 'k.square(x)' \
  --endsub \
  -j 'k.multiply(x)'
```

## Named expressions, Seeking and Combining expressions

The 'name' option -n gives a name to the result of the expression, so that you can recall it later with the -s (seek) or -c (combine) options.

```bash
# Prints 121; instead of (120*50) + 1
basho 10 -j x*10 -j x+20 -n add20 -j x*50 -s add20 -j x+1
```

The -s option allows you to seek a named result.

```bash
# Return [11, 21, 31, 41]
basho [10,20,30,40] -j x+1 -n add1 -j x+2 -n add2 -s add1
```

The -c option allows you to combine/multiplex streams into an sequence of arrays.

```bash
# Return [11, 13], [21, 23], [31, 33], [41, 43]
basho [10,20,30,40] -j x+1 -n add1 -j x+2 -n add2 -c add1,add2
```

## Recursion

The 'goto' option -g allows you to recurse to a previous named expression. It takes two parameters; (1) an expression name and (2) a predicate which stops the recursion.

Here's an expression that keeps recursing and adding 100 till it exceeds 1000.

```bash
# Prints 1025
basho 25 -j x+100 -n add1 -g add1 'x<1000'
```

## Multi-line string inputs and JSON, YAML and TOML Parsing

With the 'string' option --str basho can treat the entire input as a single string with newlines (instead of an array of lines).

```bash
# Curl returns a JSON. So this prints:
# {
#   name: 'Jeswin',
#   email: 'jeswinpk@agilehead.com',
#   date: '2020-09-09T03:28:43Z'
# }
curl 'https://api.github.com/repos/bashojs/basho/commits?per_page=5' | basho --str 'JSON.parse(x)' -j 'x[0].commit.committer'
```

If the input is JSON, there's a convenient shortcut so that you don't have to write JSON.parse. The 'json' option --json.

```bash
curl 'https://api.github.com/repos/bashojs/basho/commits?per_page=5' | basho --json -j 'x[0].commit.committer'
```

Similarly, you could pass a yaml input with the --yaml option, and toml with the --toml option.

```bash
# YAML
cat deployment.yaml | basho --yaml -j x.apiVersion

# TOML
cat cargo.toml | basho --toml -j x.package.name
```

## Promises!

If an JS expression evaluates to a promise, it is resolved before passing it to the next command in the pipeline.

```bash
# Prints 10
basho 'Promise.resolve(10)' -e 'echo ${x}'

# Something more useful
basho -i node-fetch fetch \
 -j 'fetch("http://oaks.nvg.org/basho.html")' \
 -e 'echo ${x}'
```

Btw, fetch() is also available as a built-in and usable without importing "node-fetch". See Built-in functions. 

## Logging

You can add a 'log' option -l anywhere in the pipeline to print the current value. Prints a newline at the end.

```bash
# Logs 10\n
basho 10 -l x -j x -e 'echo ${x}'
```

The 'write' option -w does the same thing as -l, but without the newline.

```bash
# Logs 10 without a newline
basho 10 -w x -j x -e 'echo ${x}'
```

## Error Handling

You can handle an error with the --error option, and choose to return an arbitrary value in its place. If unhandled, the pipeline is terminated immediately. In the following example, x.split() results in an exception on the second input (10) since a number does have the split() method. The error handler expression replaces the exception with the string 'skipped'.

```bash
basho '["a,b", 10, "c,d"]' -j 'x.split(",")' --error '"skipped"'
```

If the first argument to basho is --ignoreerror, basho will not exit on error. It will simply move to the next item.

```bash
basho --ignoreerror '["a,b", 10, "c,d"]' -j 'x.split(",")'
```

The --printerror option works like --ignoreerror, but prints the error.

```bash
basho --printerror '["a,b", 10, "c,d"]' -j 'x.split(",")'
```

Note that ignoreerror and printerror must not be preceded by any option except the -i/--import option.

You can throw an error with the error() function. 
This is often used along with `set -e` in bash; you could use the error() function to stop the script execution if a validation fails.

```bash
echo $AMOUNT | basho -j 'x > 10 ? error("Too much") : x'
```

## Real world examples

Count the number of occurences of a word in a line of text.

```bash
echo '"hello world hello hello"' | basho -j '(x.match(/hello/g) || []).length'
```

Recursively list all typescript files

```bash
find . | basho -f 'x.endsWith(".ts")'
```

Count the number of typescript files

```bash
find . | basho -f 'x.endsWith(".ts")' -a x.length
```

Get the weather in bangalore

```bash
echo '"Bangalore,in"' | basho -i node-fetch fetch 'fetch(`http://api.openweathermap.org/data/2.5/weather?q=${x}&appid=YOURAPIKEY&units=metric`)' -j 'x.json()' -j x.main.temp
```

Who wrote Harry Potter and the Philosopher's Stone?

```bash
basho -i node-fetch fetch 'fetch("https://www.googleapis.com/books/v1/volumes?q=isbn:0747532699")' -j 'x.json()' -j 'x.items[0].volumeInfo.authors'
```

Find all git hosted sub directories which might need a pull

```bash
ls | basho 'x.split("\t")' \
  -m x \
  -n dirname \
  -e 'cd ${x} && git remote update && git status' \
  -f 'x.some(_ => /branch is behind/.test(_))' \
  -s dirname
```

Find all git hosted sub directories which need to be pushed to remote

```bash
ls | basho 'x.split("\t")' \
  -m x \
  -n dirname \
  -e 'cd ${x} && git status' \
  -f '!x.some(_ => /nothing to commit/.test(_)) && !x.some(_ => /branch is up-to-date/.test(_))' \
  -s dirname
```

Check if basho version is at least 0.0.43

```bash
BASHO_VERSION=$(basho -v | basho 'x.split(".")' -j '(parseInt(x[0]) > 0 || parseInt(x[1]) > 0 || parseInt(x[2]) >= 43) && "OK"')

if [[ $BASHO_VERSION == "OK" ]]
then
  echo "All good. Format the universe."
else
  echo "Install basho version 0.0.43 or higher."
fi
```

## Here Documents for complex commands

Complex commands require a lot of quoting which makes code ugly. Fortunately, a shell feature called [Here Documents](https://tldp.org/LDP/abs/html/here-docs.html) hugely simplifies this use case. You can pretty much avoid all quoting!

Note that you need to specify each argument in a separate line (which helps readability as well). And when invoking basho, remember to use quotes around the variable (see example below). Indentation is ignored, so you can use it for formatting.

```bash
bashocmd=$(cat <<EOF
-j
  "Hello world"
-j
  x.split(" ")
EOF
)

# Prints [ 'Hello', 'world' ]
# NOTE: Put quotes around the variable!
basho "$bashocmd"
```

Asterisks don't get substituted - if you need substitution, use &lt;&lt;EOF instead of &lt;&lt; "EOF".

## Brackets

For better legibility in multi-line commands, brackets can help. A line containing an opening or closing bracket should contain nothing else, as in the example below. Brackets cannot be nested.

```bash
bashocmd=$(cat <<EOF
-j
  100
-j
  (
    x === 100
      ? x + 20
      : x + 30
  )
EOF
)

# Prints 120
# NOTE: Put quotes around the variable!
basho "$bashocmd"
```

## Bashō Recipes

This is work in progress, but you can see more real world examples at https://bashojs.org/recipes. To contribute recipes, fork https://github.com/bashojs/basho-recipes and send a pull request.

## About

Bashō is developed by [@jeswin](https://www.twitter.com/jeswin) - sponsored by [AgileHead](https://www.agilehead.com). This software has an MIT license. You can freely use it in commercial work without restrictions.

Typing basho without any parameters does nothing but might make you happy. Or reflective. This of course, is the original purpose of this app.

```bash
basho
```
