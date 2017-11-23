BashFury: Shell pipelines with the goodness of JS templates
I was stuck with a rather boring task today. I was planning to migrate from GitHub to GitLab, clean up the projects list and append some text to all the READMEs. I wanted to keep a copy at GitHub, but move active development to GitLab. With about 150 public and private repositories (of which I wanted to keep 40), this was the absolute worst way to spend my day.
If your bash foo is up to the task, this would seem achievable. Mine wasn’t. I’ve written midsize scripts before, but all I could remember was the pain in dealing with arrays and strings. I’ve been dealing with a good bit of JS for a while though, and it would be nice if I could do the heavy lifting in JS and interleave shell commands wherever needed.
Let’s  make a tool for this. It’s called bashfury.
npm install -g bashfury
Spec and Documentation
Execute JavaScript  either from an external file, or directly from the command line. External JS files may export functions or data, but as the default export using ES6 syntax. 

# cat square.js
export default function square(x) { return x ** 2; }
# Inline eval
bashfury "square = x => x*x; square(10)" -p "echo ${x}"
# From a file, square() being the default export
bashfury -f square.js 10 -p "echo ${x}"

2. If the output of a JS execution is an array, the bash command will be called once for each item in the array.

# cat numbers.js
export default const array = [1, 2, 3, 4];
# Inline
bashfury "[1,2,3,4]" -p "echo ${x}"
# With a file
bashfury -f numbers.js -p "echo ${x}"

3. If the output of JS execution is an object, use the dot notation in the bash command template.
bashfury "({ name: "jes", age: 57 })" -p "echo ${x.name}"

4. If the output of JS execution is an array of arrays, treat x as an array.
bashfury "[[1, 2, 3], [3, 4, 5]]" -p "echo ${x[0]*x[1]*x[2]}" 

5. If the output of JS execution is an array of objects, the obviously:
bashfury "[{name: "jes"}, {name: "shob"}]" -p "echo ${x.name}"

6. You can pipe the output further to more JS. And then again into a bash command and so on.

# Inline
bashfury "[1,2,3,4]" -p "echo ${x}" -p "x => x**2"
# With a file, with -pf
bashfury "[1,2,3,4]" -p "echo ${x}" -pf square.js

7. If an item in an array is undefined, it’s swallowed.

# Prints 1,2,4
bashfury "[1,2,undefined,4]" -p "echo ${x}"

8. You could also access an array index in the template literal as the variable ‘i’.

# Prints a1,b2,c3
bashfury "['a','b','c']" -p "echo ${x}${i}"
That’s all guys. Report issues or ping me on Twitter.