#!/usr/bin/env node

import "babel-polyfill";
import getStdin from "get-stdin";
import { evaluate, PipelineError } from "basho-eval";
import haikus from "./haikus";

if (require.main == module) {
  if (process.argv.length > 2) {
    //Remove import args from the beginning.
    const firstArgs = (function remove(args) {
      return args[0] === "-i" ? remove(args.slice(3)) : args;
    })(process.argv.slice(2));

    if (firstArgs[0] === "-v" || firstArgs[0] === "--version") {
      const packageJSON = require("../package.json");
      console.log(packageJSON.version);
      process.exit(0);
    } else {
      const printerror = firstArgs[0] === "--printerror";
      const ignoreerror = printerror || firstArgs[0] === "--ignoreerror";
      getStdin()
        .then(async str => {
          const input = str
            .replace(/\n$/, "")
            .split("\n")
            .filter(x => x !== "");
          const output = await evaluate(
            input.concat(process.argv.slice(2)),
            undefined,
            [],
            true,
            true,
            x => console.log(x),
            x => process.stdout.write(x.toString())
          );
          if (output.mustPrint) {
            for await (const item of output.result) {
              if (item instanceof PipelineError) {
                if (printerror) {
                  console.log(item.message);
                }
                if (!ignoreerror) {
                  throw item.error;
                }
              } else {
                console.log(item);
              }
            }
          }
          process.exit(0);
        })
        .catch(error => {
          console.log(error.message);
          process.exit(1);
        });
    }
  } else {
    const haiku = haikus[parseInt(Math.random() * haikus.length)];
    console.log(`${haiku.text}\n -${haiku.author}`);
  }
}
