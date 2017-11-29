import path from "path";
import child_process from "child_process";
import promisify from "nodefunc-promisify";
import exception from "./exception";
import { log } from "util";

const exec = promisify(child_process.exec);

/*
  Options:
    -p print
    -j JS expression
    -q Quote expression as string
    -e shell command
    -f filter
    -r reduce
    -a Treat array as a whole
    -i Import a file or module
*/

let imports = {};

class WholeArray {
  constructor(array) {
    if (!Array.isArray(array)) {
      exception(`${array} is not an Array.`);
    }
    this.array = array;
  }
}

class QuotedExpression {
  constructor(str) {
    this.str = str;
  }
}

async function withInput(
  inputPromise,
  ifSingleItem,
  ifArray,
  outputArray = false
) {
  const _input = await inputPromise;
  const input = _input instanceof WholeArray ? _input.array : _input;

  const result =
    _input instanceof WholeArray || !Array.isArray(_input)
      ? outputArray
        ? [await ifSingleItem(await input)]
        : await ifSingleItem(await input)
      : await Promise.all(
          (await Promise.all(input)).map((x, i) => ifArray(x, i))
        );
  return result;
}

async function shellCmd(template, inputPromise) {
  const fn = eval(`(x, i) => \`${template}\``);
  const outputs = await withInput(
    inputPromise,
    async x => await exec(fn(x)),
    async (x, i) => await exec(fn(x, i)),
    true
  );
  const flattened = [].concat.apply([], outputs.map(i => i.split("\n")));
  const items = flattened.filter(x => x !== "").map(x => x.replace(/\n$/, ""));
  return items.length === 1 ? items[0] : items;
}

async function evalImport(filename, alias) {
  const module = filename.startsWith("./")
    ? require(path.join(process.cwd(), filename))
    : require(filename);
  global[alias] = module;
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

async function evalExpression(exp, inputPromise) {
  const code = `(x, i) => (${exp})`;
  const fn = eval(code);
  return await withInput(inputPromise, x => fn(x), (x, i) => fn(x, i));
}

function munch(parts) {
  function doMunch(parts, expression, cursor) {
    return !parts.length ||
      ["-p", "-j", "-e", "-f", "-r", "-a", "-i"].includes(parts[0])
      ? { cursor, expression }
      : doMunch(parts.slice(1), expression.concat(parts[0]), cursor + 1);
  }
  return parts[0] === "-q"
    ? (() => {
        const { cursor, expression } = doMunch(parts.slice(1), [], 1);
        return { cursor, expression: new QuotedExpression(expression) };
      })()
    : doMunch(parts, [], 0);
}

function toExpressionString(args) {
  return args instanceof QuotedExpression
    ? `"${args.str.join(" ")}"`
    : args.join(" ");
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
      async () => {
        await evalImport(args[1], args[2]);
        return parse(args.slice(3), input, mustPrint);
      }
    ],

    /* Treat input as a whole array */
    [
      x => x === "-a",
      () => parse(args.slice(1), new WholeArray(input), mustPrint)
    ],

    /* Filter */
    [
      x => x === "-f",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        return parse(
          args.slice(cursor + 1),
          await filter(toExpressionString(expression), input),
          mustPrint
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
            input
          ),
          mustPrint
        );
      }
    ],

    /* Everything else */
    [
      x => x === "-j",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        return parse(
          args.slice(cursor + 1),
          await evalExpression(toExpressionString(expression), input),
          mustPrint
        );
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
