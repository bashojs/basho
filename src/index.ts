#!/usr/bin/env node

import "./preload";
import getStdin = require("get-stdin");
import { evaluate, PipelineValue, PipelineError } from "basho-eval";
import haikus from "./haikus";

if (require.main == module) {
  if (process.argv.length > 2) {
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
      getStdin()
        .then(async (str: string) => {
          const input = str
            .replace(/\n$/, "")
            .split("\n")
            .filter(x => x !== "");
          const output = await evaluate(
            process.argv.slice(2),
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
        })
        .catch((error: any) => {
          console.log(error.message);
          process.exit(1);
        });
    }
  } else {
    const haiku = haikus[Math.floor(Math.random() * haikus.length)];
    console.log(`${haiku.text}\n -${haiku.author}`);
  }
}
