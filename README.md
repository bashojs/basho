# Basho: Shell pipelines with the goodness of JS templates

I was stuck with a rather boring task today. I had to migrate from GitHub to
GitLab, clean up the projects list and append some text to all the READMEs. With
about 150 public and private repositories (of which I wanted to keep 50),
manually doing this was one of the worst ways to spend a day.

If your bash foo is up to the task, this would seem achievable. Mine wasn’t.
I’ve written midsize scripts before, but all I could remember was the pain in
dealing with arrays and strings. I’ve been writing a good bit of JS for a while
though, and it would be nice if I could do the heavy lifting in JS and
interleave shell commands wherever needed.

Opportunity for making a tool which makes life better. I’ll call it basho.

```bash
npm install -g basho
```

## Spec and Documentation

Basho evaluates a pipeline of instructions left to right. Instructions can be
JavaScript code, reference to an external JS file, or a shell command. To
evaluate a JavaScript expression, use the option -j. Let’s start with a single
item in the pipeline, a JavaScript constant. The option -p prints the result.
Without -p basho prints nothing.

```bash
# Prints 100
basho -p -j 100

# Prints true
basho -p -j true

# Prints 100
basho -p -j 10**2
```

Good news is, the option -j can be omitted for the first expression.

```bash
# This works too
basho -p 100

# Prints 100
basho -p 10**2
```

Working with strings is a little difficult. Since bash with chew the quotes for
itself. So you’d need to either use single quotes around your double quotes, or
just use the -q option for quoting.

```bash
# Prints hello, world
basho -p '"hello, world"'

# Here's a better way to do this
basho -p -q hello, world
```

You can pipe an expression into a subsequent expression. The variable ‘x’ is
always used as a placeholder for receiving the previous input.

```bash
# Prints 10000
basho -p 100 -j x**2
```

Execute shell commands with the -e option. The shell command is expanded as a JS
template string, with the variable ‘x’ holding the input from the preceding
command in the pipeline. Remember to quote or escape characters which hold a
special meaning in your shell, such as $, >, <, |, () etc.

```bash
# Prints 1000. Escape the $.
basho -p 1000 -e echo \${x}
```

You can import a function from a JS file or an npm module with the -i option.
The -i option takes two parameters; a filename or module name and an alias for
the import. An import is available in all subsequent expressions throughout the
pipeline.

```bash
# cat square.js
module.exports = function square(n) { return n ** 2; }

# prints 100. Imports square.js as sqr.
basho -p 10 -i square.js sqr -j "sqr(x)"

# Prints 40000. Does sqr(10), then adds 100, then sqr(200)
basho -p 10 -i square.js sqr -j "sqr(x)" -j x+100 -j "sqr(x)"
```

basho can receive input via stdin. As always, ‘x’ represents the input.

```bash
# Prints 100
echo 10 | basho -p parseInt(x)**2
```

If the input ‘x’ to a shell command is an array, the command is executed for
each item in the array.

```bash
# echo 1; echo 2; echo 3; echo 4
basho -p [1,2,3,4] -e echo \${x}
```

The input ‘x’ can also be an object, which you can expand in the template
string.

```bash
basho -p "{ name: 'jes', age: 100 }" -e echo \${x.name}, \${x.age}
```

You can use an Array of objects.

```bash
# echo kai; echo niki
basho -p "[{name:'kai'}, {name:'niki'}]" -e echo \${x.name}
```

Array of arrays, sure.

```bash
# echo 1 2 3; echo 3 4 5
basho -p "[[1,2,3], [3,4,5]]" -e echo \${x[0]} \${x[1]} \${x[2]}
```

A command can choose to receive the entire array at once with the -a option.

```bash
# echo 4
basho -p [1,2,3,4] -a x.length -e echo \${x}
```

That’s useful for filtering arrays.

```bash
# echo 3; echo 4
basho -p [1,2,3,4] -a "x.filter(x => x > 2)" -e echo \${x}
```

There’s a shorthand for filter, the option -f.

```bash
# echo 3; echo 4
basho -p [1,2,3,4] -f x>2 -e echo \${x}
```

There’s reduce too. Here’s the long form.

```bash
# Prints the sum 10
basho -p [1,2,3,4] -a "x.reduce((acc,x)=>acc+x,0)" -e echo \${x}
```

Shorthand for reduce, the option -r. The first parameter is the lambda, the
second parameter is the initial value of the accumulator.

```bash
# Prints the sum 10
basho -p [1,2,3,4] -r acc+x 0 -e echo \${x}
```

Btw, you could also access an array index in the template literal as the
variable ‘i’ in lambdas and shell command templates.

```bash
# echo a1; echo b2; echo c3
basho -p "['a','b','c']" -e echo \${x}\${i}
```

You can extend the pipeline further after a shell command. The shell command’s
stdout becomes the input for the next command.

```bash
# echo 110 - which is (10^2) + 10
basho -p 10 -j x**2 -e echo \${x} -j "parseInt(x)+10" -e echo \${x}
```

There’s nothing stopping you from using all the piping magic built into your
shell.

```bash
# Prints 100
basho -p 10 "x**2" | echo
```

Finally promises! If an JS expression evaluates to a promise, it is resolved
before passing it to the next command in the pipeline.

```bash
# Prints 10
basho "Promise.resolve(10)" -e echo \${x}

# Something more useful
basho -p -i node-fetch fetch \
 -j "fetch('http://oaks.nvg.org/basho.html')" \
 -e echo \${x}
```

## Real world use-cases

Count the number of occurences of a word in a string or file.

```bash
echo hello world hello hello | basho -p "(x.match(/hello/g) || []).length"```
```

That’s all guys. [Report issues](https://www.github.com/jeswin/basho) or ping me
on [Twitter](https://www.twitter.com/jeswin).
