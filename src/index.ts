#!/usr/bin/env node

import "./preload";
import { evaluate, PipelineValue, PipelineError } from "basho-eval";
import haikus from "./haikus";
import * as fs from "fs";
import { ReadStream } from "tty";

async function read(stream: ReadStream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

if (require.main == module) {
  if (process.argv.length > 2) {
    (async function run() {
      const [major, minor, patch] = process.version
        .substring(1)
        .split(".")
        .map(parseInt);

      if (major < 11) {
        console.log("Basho requires node version >= 11.");
        process.exit(1);
      }

      //Remove import args from the beginning.
      const firstArgs = (function remove(args: Array<string>): Array<string> {
        return args[0] === "--import" ? remove(args.slice(3)) : args;
      })(process.argv.slice(2));

      if (firstArgs[0] === "-v" || firstArgs[0] === "--version") {
        const packageJSON = require("../package.json");
        console.log(packageJSON.version);
        process.exit(0);
      } else {
        const printerror = firstArgs[0] === "--printerror";
        const ignoreerror = printerror || firstArgs[0] === "--ignoreerror";

        const stdinAsString = !process.stdin.isTTY
          ? await read(process.stdin)
          : "";

        try {
          const input = stdinAsString
            .replace(/\n$/, "")
            .split("\n")
            .filter((x) => x !== "");

          // Some of our args might have newlines.
          // Especially when using Here Documents.
          // So we split those into separate args.
          const bashoArgs = process.argv
            .slice(2)
            .flatMap((x) => x.split("\n"))
            .map((x) => x.trim())
            .filter((x) => x !== "")
            .reduce(
              (acc, x) => {
                if (acc.bracketed) {
                  if (x === ")") {
                    return {
                      args: acc.args,
                      bracketed: false,
                      bracketStart: "",
                    };
                  } else {
                    const concatenated = acc.args.slice(-1)[0] + x;
                    return {
                      args: acc.args.slice(0, -1).concat(concatenated),
                      bracketed: true,
                      bracketStart: acc.bracketStart,
                    };
                  }
                } else {
                  if (x === "(") {
                    return {
                      args: acc.args.concat(""),
                      bracketed: true,
                      bracketStart: acc.args.slice(-1)[0],
                    };
                  } else {
                    return {
                      args: acc.args.concat(x),
                      bracketed: false,
                      bracketStart: "",
                    };
                  }
                }
              },
              { args: [], bracketed: false, bracketStart: "" } as {
                args: string[];
                bracketed: boolean;
                bracketStart: string;
              }
            );

          if (bashoArgs.bracketed) {
            console.log(
              `Bracket started after '${bashoArgs.bracketStart}' was not closed.`
            );
            process.exit(1);
          }

          const output = await evaluate(
            bashoArgs.args,
            input,
            true,
            (x: string) => console.log(x),
            (x: string) => process.stdout.write(x.toString())
          );
          for await (const item of output.result) {
            if (item instanceof PipelineError) {
              if (printerror) {
                console.log(item.message);
                console.log(item.error.toString());
              }
              if (!ignoreerror) {
                throw item.error;
              }
            } else if (item instanceof PipelineValue) {
              if (output.mustPrint) {
                console.log(item.value);
              }
            }
          }
          process.exit(0);
        } catch (error: any) {
          console.log(error.message);
          process.exit(1);
        }
      }
    })();
  } else {
    const haiku = haikus[Math.floor(Math.random() * haikus.length)];
    console.log(`${haiku.text}\n -${haiku.author}`);
  }
}
