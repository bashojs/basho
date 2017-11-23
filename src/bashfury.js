function isFilename(path) {
  return path.toLowerCase().endsWith(".js");
}

/*
  Options:
    -p print
    -e shell command
    -f filter
    -i Use a named export
    -r1 First param of reduce (a function)
    -r2 Second param of reduce (initial value of accumulator)
    -a Treat array as a whole
*/

class ArrayParam {
  constructor(array) {
    this.array = array;
  }
}

async function parse(args, input, mustPrint = false) {
  const cases = [
    [
      x => x === "-e",
      async () => parse(args.slice(2), await exec(args[1], input), mustPrint)
    ],
    [x => x === "-p", () => parse(args.slice(1), input, true)],
    [
      x => x === "-i",
      async () =>
        parse(
          args.slice[3],
          await evalNamedFunction(args[1], args[2], input),
          mustPrint
        )
    ],
    [
      x => x === "-a",
      () => parse(args.slice(1), new ArrayParam(input), mustPrint)
    ],
    [
      x => x === "-f",
      () => parse(args.slice(2), filter(args[1], input, mustPrint))
    ],
    [
      x => x === "-r",
      () => parse(args.slice(2), reduce(args[1], input, mustPrint))
    ],
    [
      x => isFilename(x),
      async () => parse(args.slice(1), await evalDefaultExport(input), mustPrint)
    ]
  ];

  return 
}

parse(process.argv);
