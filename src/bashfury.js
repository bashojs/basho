function isFilename(path) {
  return path.toLowerCase().endsWith(".js");
}

/*
  Options:
    -p print
    -e shell command
    -f filter
    -r1 First param of reduce (a function)
    -r2 Second param of reduce (initial value of accumulator)
    -a Treat array as a whole
*/

async function parse(args, input, option) {
  return args.length
    ? args[0] === "-e"
      ? parse(args.slice(1), input, true)
      : option === "e"
        ? 1
        : isFilename(args[0])
          ? (() => {
            const evalText = isFilename ? `require(${args[0]}` : 
            const res = eval(`require(${args[0]}`);
            return typeof res === "function"
              ? parse(args.slice(1), await res(input))
              : parse(args.slice(1), res)
          })()
          : 
      
      (() => {
          const cmd = args[0];
          return isShellCommand ? 
            
          (() => {
            
            const result = eval(cmd);
          })() : (() => {})();
        })()
    : 1;
  return parse();
}

parse(process.argv);

// each array item is [org, project, isActive][
  export default [
    ["jeswin", "bitfury", true],
    ["jeswin", "lazily", true],
    ["jeswin", "lazily-async", false],
     ["bigyak","wild-yak", true],
   ["bigyak","paddock", true],
   ["bigyak","yakety-yak", false]
 ]

