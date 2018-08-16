# Basho: Shell Automation with Plain JavaScript

Basho lets you to write complex shell tasks using plain JavaScript without having to dabble with shell scripting.
But when needed, basho lets you easily integrate shell commands as well.

Install basho first.

```bash
npm install -g basho
```

If you have npm > 5.2.0, you can use the npx command to try basho without installing.

```bash
# For example, Prints 100
npx basho -j 100
```

### Basics

Basho evaluates a pipeline of instructions left to right. Instructions can be
JavaScript code, reference to an external JS file, or a shell command. What
makes basho interesting is
[Lazy Evaluation](https://en.wikipedia.org/wiki/Lazy_evaluation), more on this
later.

To evaluate a JavaScript expression, use the option -j. Let’s start with a
single item in the pipeline, a JavaScript constant.

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

The option -p avoids printing the final result. I am not sure where you'd need
to use it, but it's there.

```bash
# Prints nothing
basho -p 100
```

Working with strings is a little difficult. Since bash will chew the quotes for
itself, you’d need to either use single quotes around your double quotes. So we
have a shorthand for this, the -q option.

```bash
# Prints hello, world
basho '"hello, world"'

# Here's another way to do this
basho -q hello, world
```

### Piping Results

You can pipe an expression into a subsequent expression. The variable ‘x’ is
always used as a placeholder for receiving the previous input.

```bash
# Prints 10100
basho 100 -j x**2 -j x+100
```

### Lazy evaluation and exit conditions

You may choose to terminate the pipeline with the -t option when a condition is
met. Since the pipeline is lazy, further expressions (or bash commands) are not
evaluated.

```bash
# Prints 10 and 20. The rest are never evaluated.
basho [1,2,3,4,5] -t 'x>2' -j x*10
```

### Shell Commands

Execute shell commands with the -e option. The shell command is expanded as a JS
template string, with the variable ‘x’ holding the input from the preceding
command in the pipeline. Remember to quote or escape characters which hold a
special meaning in your shell, such as $, >, <, |, () etc.

Tip: Single quotes are far easier to work with, since double quotes will try to
expand $variables inside it.

```bash
# Prints 1000. Escape the $.
basho 1000 -e echo \${x}
```

You can extend the pipeline further after a shell command. The shell command’s
output becomes the input for the next command.

```bash
# echo 110 - which is (10^2) + 10
basho 10 -j x**2 -e echo \${x} -j 'parseInt(x)+10' -e echo \${x}
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
basho 10 -j x**2 | xargs echo
```

If the input 'x' has spaces, basho will escape them before executing the shell command.

```bash
# This translates to cat Untitled\ Document.txt
basho -q Untitled\ Document.txt -e cat \${x}
```

### Importing JS files

You can import a function from a JS file or an npm module with the -i option.
The -i option takes two parameters; a filename or module name and an alias for
the import. An import is available in all subsequent expressions throughout the
pipeline.

```bash
# cat square.js
module.exports = function square(n) { return n ** 2; }

# prints 100. Imports square.js as sqr.
basho 10 -i square.js sqr -j 'sqr(x)'

# Prints 40000. Does sqr(10), then adds 100, then sqr(200)
basho 10 -i square.js sqr -j 'sqr(x)' -j x+100 -j 'sqr(x)'
```

### Arrays, map, filter, flatMap and reduce

If the input to an expression is an array, the subsequent expression or command
is executed for each item in the array. It's the equivalent of a map() function.

```bash
# echo 1; echo 2; echo 3; echo 4
basho [1,2,3,4] -e echo \${x}
```

An input can also be an object, which you can expand in the template string.

```bash
basho '{ name: "jes", age: 100 }' -e echo \${x.name}, \${x.age}
```

You can use an Array of objects.

```bash
# echo kai; echo niki
basho '[{name:"kai"}, {name: "niki"}]' -e echo \${x.name}
```

Array of arrays, sure.

```bash
# echo 1 2 3; echo 3 4 5
basho '[[1,2,3], [3,4,5]]' -e echo \${x[0]} \${x[1]} \${x[2]}
```

A command can choose to receive the entire array at once with the -a option.

```bash
# echo 4
basho [1,2,3,4] -a x.length -e echo \${x}
```

Filter arrays with the -f option.

```bash
# echo 3; echo 4
basho [1,2,3,4] -f 'x>2' -e echo \${x}
```

Reduce with the -r option. The first parameter is the lambda, the second
parameter is the initial value of the accumulator.

```bash
# Prints the sum 10
basho [1,2,3,4] -r acc+x 0 -e echo \${x}
```

There's also flatMap, the -m option.

```bash
# Returns [11, 21, 12, 22, 13, 23]
basho [1,2,3] -m [x+10,x+20]
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
basho '["a", "b", "c"]' -e echo \${x}\${i}
```

### Named expressions, Seeking and Combining expressions

The -n option gives a name to the result of the expression, so that you can
recall it later with the -s (seek) or -c (combine) options.

```
# Prints 121; instead of (120*50) + 1
basho 10 -j x*10 -j x+20 -n add20 -j x*50 -s add20 -j x+1
```

The -s option allows you to seek a named result.

```
# Return [11, 21, 31, 41]
basho [10,20,30,40] -j x+1 -n add1 -j x+2 -n add2 -s add1
```

The -c option allows you to combine/multiplex streams into an sequence of
arrays.

```
# Return [11, 13], [21, 23], [31, 33], [41, 43]
basho [10,20,30,40] -j x+1 -n add1 -j x+2 -n add2 -c add1,add2
```

### Recursion

The -g option allows you to recurse to a previous named expression.
It takes two parameters; (1) an expression name and (2) a predicate which stops the recursion.

Here's an expression that keeps recursing and adding 100 till it exceeds 1000.

```
# Prints 1025
basho 25 -j x+100 -n add1 -g add1 'x<1000'
```

Recursion is powerful. For instance, along with a promise that sleeps for a specified time,
recursion can use used to periodically run a command. Usage is left to the reader as an exercise.

### Promises!

If an JS expression evaluates to a promise, it is resolved before passing it to
the next command in the pipeline.

```bash
# Prints 10
basho 'Promise.resolve(10)' -e echo \${x}

# Something more useful
basho -i node-fetch fetch \
 -j 'fetch("http://oaks.nvg.org/basho.html")' \
 -e echo \${x}
```

### Logging

You can add a -l option anywhere in the pipeline to print the current value.

```bash
# Logs 10\n
basho 10 -l x -j x -e echo \${x}
```

The -w option does the same thing, but without the newline.

```bash
# Logs 10 without a newline
basho 10 -w x -j x -e echo \${x}
```

### Error Handling

You can handle an error with the --error option, and choose to return an
arbitrary value in its place. If unhandled, the pipeline is terminated
immediately. In the following example, x.split() results in an exception on the
second input (10) since a number does have the split() method. The error handler
expression replaces the exception with the string 'skipped'.

```bash
basho '["a,b", 10, "c,d"]' -j 'x.split(",")' --error '"skipped"'
```

If the first argument to basho is --ignoreerror, basho will not exit on error.
It will simply move to the next item.

```bash
basho --ignoreerror '["a,b", 10, "c,d"]' -j 'x.split(",")'
```

The --printerror option works like --ignoreerror, but prints the error.

```bash
basho --printerror '["a,b", 10, "c,d"]' -j 'x.split(",")'
```

Note that ignoreerror and printerror must not be preceded by any option except
the -i import option.

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
basho -e 'ls -alt' \
 -j 'x.split(/\s+/)' \
 -f 'x.length>2' \
 -j 'x.slice(-1)[0]' \
 -f '![".", ".."].includes(x)' \
 -n dirname \
 -e 'cd ${x} && git remote update && git status' \
 -f 'x.some(_ => /branch is behind/.test(_))' \
 -s dirname
```

Same thing using shell piping

```bash
ls -alt | basho 'x.split(/\s+/)' \
 -f 'x.length>2' \
 -j 'x.slice(-1)[0]' \
 -f '![".", ".."].includes(x)' \
 -n dirname \
 -e 'cd ${x} && git remote update && git status' \
 -f 'x.some(_ => /branch is behind/.test(_))' \
 -s dirname
```

Find all git hosted sub directories which need to be pushed to remote

```bash
ls -alt | basho 'x.split(/\s+/)' \
  -f 'x.length>2' \
  -j 'x.slice(-1)[0]' \
  -f '![".", ".."].includes(x)' \
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

## That's it

Typing basho without any parameters does nothing but might make you happy. Or
sad.

```bash
basho
```

[Report issues](https://www.github.com/jeswin/basho) or ping me on
[Twitter](https://www.twitter.com/jeswin).
