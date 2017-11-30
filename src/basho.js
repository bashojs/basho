#!/usr/bin/env node

import parse from "./parse";
import getStdin from "get-stdin";
import haikus from "./haikus";

if (process.argv.length > 2) {
  if (process.argv[2] === "-v") {
    console.log("0.0.5");
    process.exit(0);
  } else {
    getStdin()
      .then(async str => {
        const input = str.replace(/\n$/, "").split("\n");
        const output = await parse(
          process.argv.slice(2),
          input.length > 1 ? input : input[0]
        );
        if (output.mustPrint) {
          if (Array.isArray(output.result)) {
            output.result.forEach(i => console.log(i));
          } else {
            console.log(output.result);
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
