import path from "path";
import child_process from "child_process";
import promisify from "nodefunc-promisify";
import { Seq } from "lazily-async";
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
    -d Evaluate and print a value for debugging
    --stack Use input from the result stack
    --nostack Disables the result stack
*/

class QuotedExpression {
  constructor(str) {
    this.str = str;
  }
}

function shellCmd(template, input) {
  const fn = eval(`(x, i) => \`${template}\``);
  return input.map(input, async (x, i) => exec(fn(x, i)));
}

function evalImport(filename, alias) {
  const module = filename.startsWith("./")
    ? require(path.join(process.cwd(), filename))
    : require(filename);
  global[alias] = module;
}

async function filter(exp, input) {
  const code = `(x, i) => (${exp})`;
  const fn = eval(code);
  const items = await input.toArray();
  return items.filter((x, i) => fn(x, i));
}

async function reduce(exp, input, initialValue) {
  const code = `(acc, x, i) => (${exp})`;
  const fn = eval(code);
  const items = await input.toArray();
  return items.reduce((acc, x, i) => fn(acc, x, i), eval(initialValue));
}

function evalExpression(exp, _input) {
  debugger;
  const input =
    _input instanceof Seq
      ? _input
      : Array.isArray(_input) ? Seq.of(_input) : Seq.of([_input]);
  input.toArray().then(x => {
    debugger;
  });
  const code = `(x, i) => (${exp})`;
  return input.map(eval(code));
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
        "-d",
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

export default function parse(
  args,
  input,
  results = [],
  useResultStack = true,
  mustPrint = true,
  onDebug
) {
  const cases = [
    /* Disable result stacking */
    [
      x => x === "--nostack",
      () => {
        return parse(args.slice(1), results, true, mustPrint, onDebug);
      }
    ],

    /* Use results from the stack */
    [
      x => x === "--stack",
      () => {
        const [from, to] = args[1].split(",");
        return typeof to === "undefined"
          ? doParse(args.slice(2), results[results.length - 1 - parseInt(from)])
          : doParse(args.slice(2), results.slice(from, to));
      }
    ],

    /* Execute shell command */
    [
      x => x === "-e",
      () => {
        const { cursor, expression } = munch(args.slice(1));
        return doParse(
          args.slice(cursor + 1),
          shellCmd(toExpressionString(expression), input)
        );
      }
    ],

    /* Print */
    [
      x => x === "-p",
      () => parse(args.slice(1), input, results, useResultStack, false, onDebug)
    ],

    /* Named Export */
    [
      x => x === "-i",
      () => {
        evalImport(args[1], args[2]);
        return doParse(args.slice(3), input);
      }
    ],

    /* Treat input as a whole array */
    [x => x === "-a", () => doParse(args.slice(1), input.toArray())],

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
            input,
            initialValue
          )
        );
      }
    ],

    /* Debug */
    [
      x => x === "-d",
      () => {
        const { cursor, expression } = munch(args.slice(1));
        const fn = eval(`(x, i) => (${expression})`);
        const newSeq = Seq.of(input).map(async (x, i) => {
          const res = fn(x, i);
          onDebug(x);
          return x;
        });
        return doParse(args.slice(cursor + 1), newSeq);
      }
    ],

    /* JS expressions */
    [
      x => x === "-j",
      () => {
        const { cursor, expression } = munch(args.slice(1));
        return doParse(
          args.slice(cursor + 1),
          evalExpression(toExpressionString(expression), input)
        );
      }
    ],

    /* Everything else as JS expressions */
    [
      x => true,
      () => {
        const { cursor, expression } = munch(args);
        return doParse(
          args.slice(cursor + 1),
          evalExpression(toExpressionString(expression), input)
        );
      }
    ]
  ];

  function doParse(args, input) {
    return parse(
      args,
      input,
      useResultStack ? results.concat([input]) : results,
      useResultStack,
      mustPrint,
      onDebug
    );
  }

  return args.length
    ? cases.find(([predicate]) => predicate(args[0]))[1]()
    : { mustPrint, result: input };
}
