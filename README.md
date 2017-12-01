# Basho: Shell macros with the goodness of JavaScript templates

Installation

```bash
npm install -g basho
```

### Basics

Basho evaluates a pipeline of instructions left to right. Instructions can be
JavaScript code, reference to an external JS file, or a shell command. To
evaluate a JavaScript expression, use the option -j. Let’s start with a single
item in the pipeline, a JavaScript constant.

```bash
# Prints 100
basho -j 100

# Prints true
basho -j true

# Prints 100
basho -j 10**2
```

Good news is, the option -j can be omitted for the first expression.

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
made a shorthand for this, the -q option.

```bash
# Prints hello, world
basho '"hello, world"'

# Here's a better way to do this
basho -q hello, world
```

### Piping Results

You can pipe an expression into a subsequent expression. The variable ‘x’ is
always used as a placeholder for receiving the previous input.

```bash
# Prints 10000
basho 100 -j x**2
```

### Shell Commands

Execute shell commands with the -e option. The shell command is expanded as a JS
template string, with the variable ‘x’ holding the input from the preceding
command in the pipeline. Remember to quote or escape characters which hold a
special meaning in your shell, such as $, >, <, |, () etc.

```bash
# Prints 1000. Escape the $.
basho 1000 -e echo \${x}
```

You can extend the pipeline further after a shell command. The shell command’s
output becomes the input for the next command.

```bash
# echo 110 - which is (10^2) + 10
basho 10 -j x**2 -e echo \${x} -j "parseInt(x)+10" -e echo \${x}
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
basho 10 -i square.js sqr -j "sqr(x)"

# Prints 40000. Does sqr(10), then adds 100, then sqr(200)
basho 10 -i square.js sqr -j "sqr(x)" -j x+100 -j "sqr(x)"
```

Reading from stdin

basho can receive input via stdin. As always, ‘x’ represents the input.

```bash
# Prints 100
echo 10 | basho parseInt(x)**2
```

### Arrays, Filter and Reduce

If the input to an expression is an array, the subsequent expression or command
is executed for each item in the array.

```bash
# echo 1; echo 2; echo 3; echo 4
basho [1,2,3,4] -e echo \${x}
```

An input can also be an object, which you can expand in the template string.

```bash
basho "{ name: 'jes', age: 100 }" -e echo \${x.name}, \${x.age}
```

You can use an Array of objects.

```bash
# echo kai; echo niki
basho "[{name:'kai'}, {name:'niki'}]" -e echo \${x.name}
```

Array of arrays, sure.

```bash
# echo 1 2 3; echo 3 4 5
basho "[[1,2,3], [3,4,5]]" -e echo \${x[0]} \${x[1]} \${x[2]}
```

A command can choose to receive the entire array at once with the -a option.

```bash
# echo 4
basho [1,2,3,4] -a x.length -e echo \${x}
```

That’s useful for filtering arrays.

```bash
# echo 3; echo 4
basho [1,2,3,4] -a "x.filter(x => x > 2)" -e echo \${x}
```

There’s a shorthand for filter, the option -f.

```bash
# echo 3; echo 4
basho [1,2,3,4] -f x>2 -e echo \${x}
```

There’s reduce too. Here’s the long form.

```bash
# Prints the sum 10
basho [1,2,3,4] -a "x.reduce((acc,x)=>acc+x,0)" -e echo \${x}
```

Shorthand for reduce, the option -r. The first parameter is the lambda, the
second parameter is the initial value of the accumulator.

```bash
# Prints the sum 10
basho [1,2,3,4] -r acc+x 0 -e echo \${x}
```

Btw, you could also access an array index in the template literal as the
variable ‘i’ in lambdas and shell command templates.

```bash
# echo a1; echo b2; echo c3
basho "['a','b','c']" -e echo \${x}\${i}
```

There’s nothing stopping you from using all the piping magic built into your
shell.

```bash
# Prints 100
basho 10 x**2 | echo
```

Promises! If an JS expression evaluates to a promise, it is resolved before
passing it to the next command in the pipeline.

```bash
# Prints 10
basho "Promise.resolve(10)" -e echo \${x}

# Something more useful
basho -i node-fetch fetch \
 -j "fetch('http://oaks.nvg.org/basho.html')" \
 -e echo \${x}
```

### Debugging

You can add a -d option anywhere in the pipeline to print the current value.

```bash
basho 10 -d x+11 -j x -e echo \${x}
```

### Advanced

You can reference the output of any previous expression in a pipeline with the
--stack option. The parameter to --stack can be an index indicating how many
steps you want to go back, or it can be a range. Examples below.

```bash
# Prints [2,3,4,5]
basho [1,2,3,4] -j x+1 -j x+2 --stack 1

# Prints [2,3,4,5]
basho [1,2,3,4] -j x+1 -j x+2 --stack 1,2 -j x
```

To turn off saving previous results (for performance reasons), use the --nostack
option. Turning it off is hardly ever required, except when you're dealing with
huge text transforms.

### Tip

If you need the fetch module (or any other) often, you’re better off creating an
alias for basho in .bashrc (or .bash_profile on a Mac).

```bash
# in .bashrc
alias basho='basho -i node-fetch fetch'

# now you could just do
basho "fetch('example.com/weather')" -j x.temperature
```

## Real world examples

Count the number of occurences of a word in a string or file.

````bash
echo hello world hello hello | basho "(x.match(/hello/g) || []).length"```
````

Get the weather in bangalore

```bash
echo Bangalore,in | basho "fetch(\`http://api.openweathermap.org/data/2.5/weather?q=\${x}&appid=YOURAPIKEY&units=metric\`)" -j "x.json()" -j x.main.temp
```

## That's it

Typing basho without any parameters does nothing but might make you happy. Or
sad.

```bash
basho
```

[Report issues](https://www.github.com/jeswin/basho) or ping me on
[Twitter](https://www.twitter.com/jeswin).
