import path from "path";
import child_process from "child_process";
import promisify from "nodefunc-promisify";
import exception from "./exception";

const exec = promisify(child_process.exec);

/*
  Options:
    -p print
    -j JS expression
    -e shell command
    -f filter
    -r reduce
    -a Treat array as a whole
    -i Use a named export
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

async function withInput(
  inputPromise,
  ifSingleItem,
  ifArray,
  outputArray = false
) {
  const _input = await inputPromise;
  const input = _input instanceof ArrayParam ? _input.array : _input;

  return _input instanceof ArrayParam || !Array.isArray(_input)
    ? outputArray
      ? [await ifSingleItem(await input)]
      : await ifSingleItem(await input)
    : await Promise.all(
        (await Promise.all(input)).map((x, i) => ifArray(x, i))
      );
}

async function shellCmd(template, inputPromise) {
  const fn = eval(`x => \`${template}\``);
  const outputs = await withInput(
    inputPromise,
    async x => await exec(fn(x), { stdio: "inherit" }),
    async x => await exec(fn(x), { stdio: "inherit" }),
    true
  );
  const flattened = [].concat.apply([], outputs.map(i => i.split("\n")));
  const items = flattened.filter(x => x !== "").map(x => x.replace(/\n$/, ""));
  return items.length === 1 ? items[0] : items;
}

async function evalNamedFunction(filename, exportName, inputPromise) {
  const module = require(path.join(process.cwd(), filename));
  const item =
    exportName === "default"
      ? typeof module === "function" ? module : module.default
      : module[exportName];
  return typeof item !== "function"
    ? item
    : await withInput(inputPromise, x => item(x), (x, i) => item(x, i));
}

async function filter(exp, inputPromise) {
  const input = await inputPromise;
  const code = `(x, i) => (${exp})`;
  const fn = eval(code);
  return Array.isArray(input)
    ? (await Promise.all(input)).filter((x, i) => fn(x, i))
    : exception(`${input} is not an Array.`);
}

async function reduce(exp, initialValue, inputPromise) {
  const input = await inputPromise;
  const code = `(acc, x, i) => (${exp})`;
  const fn = eval(code);
  return Array.isArray(input)
    ? (await Promise.all(input)).reduce(
        (acc, x, i) => fn(acc, x, i),
        eval(initialValue)
      )
    : exception(`${input} is not an Array.`);
}

async function evalDefaultExport(filename, input) {
  return await evalNamedFunction(filename, "default", input);
}

async function evalExpression(exp, inputPromise) {
  const code = `(x, i) => (${exp})`;
  const fn = eval(code);
  return await withInput(inputPromise, x => fn(x), (x, i) => fn(x, i));
}

function munch(parts, expression = [], cursor = 0) {
  return !parts.length ||
    ["-p", "-j", "-e", "-f", "-r", "-a", "-i"].includes(parts[0])
    ? { cursor, expression }
    : munch(parts.slice(1), expression.concat(parts[0]), cursor + 1);
}

function toExpressionString(args) {
  return args.join("");
}

export default async function parse(args, input, mustPrint = false) {
  const cases = [
    /* Execute shell command */
    [
      x => x === "-e",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        return parse(
          args.slice(cursor + 1),
          await shellCmd(toExpressionString(expression), input),
          mustPrint
        );
      }
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
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        return parse(
          args.slice(cursor + 1),
          await filter(toExpressionString(expression), input, mustPrint)
        );
      }
    ],

    /* Reduce */
    [
      x => x === "-r",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        const initialValue = expression.slice(-1)[0];
        return parse(
          args.slice(cursor + 1),
          await reduce(
            toExpressionString(expression.slice(0, -1)),
            initialValue,
            input,
            mustPrint
          )
        );
      }
    ],

    /* Is a file */
    [
      x => isFilename(x),
      async () =>
        parse(args.slice(1), await evalDefaultExport(args[0], input), mustPrint)
    ],

    /* Everything else */
    [
      x => x === "-j",
      async () => {
        return isFilename(args[1])
          ? parse(args.slice(2), await evalDefaultExport(args[1], input), mustPrint)
          : (async () => {
            const { cursor, expression } = munch(args.slice(1));
            return parse(
              args.slice(cursor + 1),
              await evalExpression(toExpressionString(expression), input),
              mustPrint
            );    
          })()
      }
    ],

    /* Everything else */
    [
      x => true,
      async () => {
        const { cursor, expression } = munch(args);
        return parse(
          args.slice(cursor),
          await evalExpression(toExpressionString(expression), input),
          mustPrint
        );
      }
    ]
  ];

  return args.length
    ? await cases.find(([predicate]) => predicate(args[0]))[1]()
    : { mustPrint, result: input };
}
