import path from "path";
import child_process from "child_process";
import promisify from "nodefunc-promisify";
import exception from "./exception";

const exec = promisify(child_process.exec);

/*
  Options:
    -p print
    -e shell command
    -i Use a named export
    -f filter
    -r reduce
    -a Treat array as a whole
*/

function isFilename(path) {
  return path.toLowerCase().endsWith(".js");
}

class ArrayParam {
  constructor(array) {
    if (!Array.isArray(array)) {
      exception(`${array} is not an Array.`);
    }
    this.array = array;
  }
}

async function shellCmd(template, inputPromise) {
  const input = await inputPromise;
  const fn = eval(`x => \`${template}\``);
  const outputs =
    input instanceof ArrayParam
      ? [await exec(fn(input.array))]
      : !Array.isArray(input)
        ? [await exec(fn(input))]
        : await Promise.all(input.map(i => exec(fn(i))));
  const flattened = [].concat.apply([], outputs.map(i => i.split("\n")));
  const items = flattened.filter(x => x !== "").map(x => x.replace(/\n$/, ""));
  return items.length === 1 ? items[0] : items;
}

async function evalNamedFunction(filename, exportName, inputPromise) {
  const input = await inputPromise;
  const module = require(path.join(process.cwd(), filename));
  const item =
    exportName === "default"
      ? typeof module === "function" ? module : module.default
      : module[exportName];
  return typeof item !== "function"
    ? item
    : input instanceof ArrayParam
      ? await item(input.array)
      : !Array.isArray(input)
        ? await item(input)
        : input.map((x, i) => item(x, i));
}

async function filter(exp, inputPromise) {
  const input = await inputPromise;
  const code = `(x, i) => (${exp})`;
  const fn = eval(code);
  return input instanceof ArrayParam
    ? await fn(input.array)
    : Array.isArray(input)
      ? input.filter((x, i) => fn(x, i))
      : exception(`${input} is not an Array.`);
}

async function reduce(exp, initialValue, inputPromise) {
  const input = await inputPromise;
  const code = `(acc, x, i) => (${exp})`;
  const fn = eval(code);
  return input instanceof ArrayParam
    ? await fn(input.array)
    : Array.isArray(input)
      ? input.reduce((x, i) => fn(x, i), eval(initialValue))
      : exception(`${input} is not an Array.`);
}

async function evalDefaultExport(filename, input) {
  return await evalNamedFunction(filename, "default", input);
}

async function evalExpression(exp, inputPromise) {
  const input = await inputPromise;
  const code = `(x, i) => (${exp})`;
  const fn = eval(code);
  return input instanceof ArrayParam
    ? await fn(input.array)
    : !Array.isArray(input) ? await fn(input) : input.map((x, i) => fn(x, i));
}

export default async function parse(args, input, mustPrint = false) {
  const cases = [
    /* Execute shell command */
    [
      x => x === "-e",
      async () =>
        parse(args.slice(2), await shellCmd(args[1], input), mustPrint)
    ],
    /* Print */
    [x => x === "-p", () => parse(args.slice(1), input, true)],
    /* Named Export */
    [
      x => x === "-i",
      async () =>
        parse(
          args.slice(3),
          await evalNamedFunction(args[1], args[2], input),
          mustPrint
        )
    ],
    /* Treat input as a whole array */
    [
      x => x === "-a",
      () => parse(args.slice(1), new ArrayParam(input), mustPrint)
    ],
    /* Filter */
    [
      x => x === "-f",
      async () => parse(args.slice(2), await filter(args[1], input, mustPrint))
    ],
    /* Reduce */
    [
      x => x === "-r",
      async () =>
        parse(args.slice(3), await reduce(args[1], args[2], input, mustPrint))
    ],
    /* Is a file */
    [
      x => isFilename(x),
      async () =>
        parse(args.slice(1), await evalDefaultExport(args[0], input), mustPrint)
    ],
    /* Everything else */
    [
      x => true,
      async () =>
        parse(args.slice(1), await evalExpression(args[0], input), mustPrint)
    ]
  ];

  return args.length
    ? await cases.find(([predicate]) => predicate(args[0]))[1]()
    : { mustPrint, result: input };
}
