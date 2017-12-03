import path from "path";
import child_process from "child_process";
import promisify from "nodefunc-promisify";
import { Seq } from "lazily-async";
import exception from "./exception";
import { log } from "util";

const exec = promisify(child_process.exec);

/*
  Options:
    -p          print
    -j          JS expression
    -q          quote expression as string
    -e          shell command
    -f          filter
    -m          flatMap
    -r          reduce
    -a          treat array as a whole
    -i          import a file or module
    -l          evaluate and log a value to console
    -w          Same as log, but without the newline
    -t          terminate evaluation
    -d          removes the previous expression result from the pipeline
    --stack     Use input from the result stack
    --nostack   Disables the result stack
*/

class QuotedExpression {
  constructor(str) {
    this.str = str;
  }
}

async function evalExpression(exp, _input) {
  return typeof _input === "undefined" || _input === ""
    ? await (async () => {
        const code = `async () => (${exp})`;
        const input = await eval(code)();
        return Array.isArray(input) ? Seq.of(input) : Seq.of([input]);
      })()
    : await (async () => {
        const code = `async (x, i) => (${exp})`;
        const input =
          _input instanceof Seq
            ? _input
            : Array.isArray(_input) ? Seq.of(_input) : Seq.of([_input]);
        return input.map(await eval(code));
      })();
}

async function shellCmd(template, input) {
  const fn = await eval(`async (x, i) => \`${template}\``);
  return typeof input === "undefined" || input === ""
    ? await (async () => {
        const shellResult = await exec(await fn());
        const items = shellResult
          .split("\n")
          .filter(x => x !== "")
          .map(x => x.replace(/\n$/, ""));
        return Seq.of(items);
      })()
    : (() => {
        return input.map(async (x, i) => {
          const shellResult = await exec(await fn(x, i));
          const items = shellResult
            .split("\n")
            .filter(x => x !== "")
            .map(x => x.replace(/\n$/, ""));
          return items.length === 1 ? items[0] : items;
        });
      })();
}

function evalImport(filename, alias) {
  const module = filename.startsWith("./")
    ? require(path.join(process.cwd(), filename))
    : require(filename);
  global[alias] = module;
}

async function filter(exp, input) {
  const code = `async (x, i) => (${exp})`;
  const fn = await eval(code);
  return input.filter(fn);
}

async function reduce(exp, input, initialValue) {
  const code = `async (acc, x, i) => (${exp})`;
  const fn = await eval(code);
  return await input.reduce(fn, await eval(initialValue));
}

async function flatMap(exp, input) {
  const code = `async (x, i) => (${exp})`;
  const fn = await eval(code);
  return input.flatMap(fn);
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
        "-m",
        "-a",
        "-i",
        "-l",
        "-w",
        "-q",
        "-t",
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

export default async function parse(
  args,
  input,
  results = [],
  useResultStack = true,
  mustPrint = true,
  onLog,
  onWrite
) {
  const cases = [
    /* Disable result stacking */
    [
      x => x === "--nostack",
      async () => await parse(args.slice(1), results, true, mustPrint, onLog, onWrite)
    ],

    /* Use results from the stack */
    [
      x => x === "--stack",
      async () =>
        await doParse(
          args.slice(2),
          results[results.length - 1 - parseInt(args[1])]
        )
    ],

    /* Execute shell command */
    [
      x => x === "-e",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        return await doParse(
          args.slice(cursor + 1),
          await shellCmd(toExpressionString(expression), input)
        );
      }
    ],

    /* Print */
    [
      x => x === "-p",
      async () =>
        await parse(
          args.slice(1),
          input,
          results,
          useResultStack,
          false,
          onLog,onWrite
        )
    ],

    /* Named Export */
    [
      x => x === "-i",
      async () => {
        evalImport(args[1], args[2]);
        return await doParse(args.slice(3), input);
      }
    ],

    /* Removes an expression result from the pipeline */
    [
      x => x === "-d",
      async () =>
        await parse(
          args.slice(1),
          results.slice(-2)[0],
          results.slice(0, -1),
          useResultStack,
          mustPrint,
          onLog,
          onWrite
        )
    ],

    /* Enumerate sequence into an array */
    [
      x => x === "-a",
      async () => await doParse(args.slice(1), [await input.toArray()])
    ],

    /* Filter */
    [
      x => x === "-f",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        const filtered = await filter(toExpressionString(expression), input);
        return await doParse(args.slice(cursor + 1), Seq.of(filtered));
      }
    ],

    /* Reduce */
    [
      x => x === "-r",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        const initialValue = expression.slice(-1)[0];
        const reduced = await reduce(
          toExpressionString(expression.slice(0, -1)),
          input,
          initialValue
        );
        return await doParse(args.slice(cursor + 1), Seq.of([reduced]));
      }
    ],

    /* Flatmap */
    [
      x => x === "-m",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        const filtered = await flatMap(toExpressionString(expression), input);
        return await doParse(args.slice(cursor + 1), Seq.of(filtered));
      }
    ],

    /* Logging */
    [
      x => x === "-l",
      async () => {
        const x = await input.toArray();
        const { cursor, expression } = munch(args.slice(1));
        const fn = await eval(`(x, i) => (${expression})`);
        const newSeq = Seq.of(input).map(async (x, i) => {
          const res = await fn(x, i);
          onLog(res);
          return x;
        });
        return await doParse(args.slice(cursor + 1), newSeq);
      }
    ],

    /* Writing */
    [
      x => x === "-w",
      async () => {
        const x = await input.toArray();
        const { cursor, expression } = munch(args.slice(1));
        const fn = await eval(`(x, i) => (${expression})`);
        const newSeq = Seq.of(input).map(async (x, i) => {
          const res = await fn(x, i);
          onWrite(res);
          return x;
        });
        return await doParse(args.slice(cursor + 1), newSeq);
      }
    ],

    /* JS expressions */
    [
      x => x === "-j",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        return await doParse(
          args.slice(cursor + 1),
          await evalExpression(toExpressionString(expression), input)
        );
      }
    ],

    /* Exit the pipeline */
    [
      x => x === "-t",
      async () => {
        const { cursor, expression } = munch(args.slice(1));
        async function* asyncGenerator() {
          const fn = await eval(`(x, i) => (${expression})`);
          let i = 0;
          for await (const x of input) {
            const res = fn(x, i);
            if (res === true) return;
            else {
              yield x;
              i++;
            }
          }
        }
        return await doParse(args.slice(cursor + 1), new Seq(asyncGenerator));
      }
    ],

    [
      /* Everything else as JS expressions */
      x => true,
      async () => {
        const { cursor, expression } = munch(args);
        return await doParse(
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
      mustPrint,
      onLog,
      onWrite
    );
  }

  return args.length
    ? await cases.find(([predicate]) => predicate(args[0]))[1]()
    : { mustPrint, result: input };
}
