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
    --stack Use input from the result stack
    --nostack Disables the result stack
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
      : input.length
        ? await (async function loop(inputs, counter = 0, acc = []) {
            return inputs.length
              ? await (async () => {
                  const [first, ...rest] = inputs;
                  const firstInput = await first;
                  const result = await ifArray(firstInput, counter);
                  return loop(rest, counter + 1, acc.concat([result]));
                })()
              : acc;
          })(input)
        : [];
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
      [
        "-p",
        "-j",
        "-e",
        "-f",
        "-r",
        "-a",
        "-i",
        "--stack",
        "--nostack"
      ].includes(parts[0])
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

export default async function parse(
  args,
  input,
  results = [],
  useResultStack = true,
  mustPrint = true
) {
  const cases = [
    /* Disable result stacking */
    [
      x => x === "--nostack",
      async () => {
        return parse(args.slice(1), input, results, true, mustPrint);
      }
    ],

    /* Use results from the stack */
    [
      x => x === "--stack",
      async () => {
        const [from, to] = args[1].split(",");
        return typeof to === "undefined"
          ? doParse(args.slice(2), results[results.length - 1 - parseInt(from)])
          : doParse(args.slice(2), results.slice(from, to));
      }
    ],

    /* Execute shell command */
    [
      x => x === "-e",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        return doParse(
          args.slice(cursor + 1),
          await shellCmd(toExpressionString(expression), input)
        );
      }
    ],

    /* Print */
    [
      x => x === "-p",
      () => parse(args.slice(1), input, results, useResultStack, false)
    ],

    /* Named Export */
    [
      x => x === "-i",
      async () => {
        await evalImport(args[1], args[2]);
        return doParse(args.slice(3), input);
      }
    ],

    /* Treat input as a whole array */
    [x => x === "-a", () => doParse(args.slice(1), new WholeArray(input))],

    /* Filter */
    [
      x => x === "-f",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        return doParse(
          args.slice(cursor + 1),
          await filter(toExpressionString(expression), input)
        );
      }
    ],

    /* Reduce */
    [
      x => x === "-r",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        const initialValue = expression.slice(-1)[0];
        return doParse(
          args.slice(cursor + 1),
          await reduce(
            toExpressionString(expression.slice(0, -1)),
            initialValue,
            input
          )
        );
      }
    ],

    /* Everything else */
    [
      x => x === "-j",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        mustPrint;
        return doParse(
          args.slice(cursor + 1),
          await evalExpression(toExpressionString(expression), input)
        );
      }
    ],

    /* Everything else */
    [
      x => true,
      async () => {
        const { cursor, expression } = munch(args);
        return doParse(
          args.slice(cursor),
          await evalExpression(toExpressionString(expression), input)
        );
      }
    ]
  ];

  async function doParse(args, input) {
    return await parse(
      args,
      input,
      useResultStack ? results.concat([input]) : results,
      useResultStack,
      mustPrint
    );
  }

  return args.length
    ? await cases.find(([predicate]) => predicate(args[0]))[1]()
    : { mustPrint, result: input };
}
