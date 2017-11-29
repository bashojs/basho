#!/usr/bin/env node

import parse from "./parse";
import getStdin from "get-stdin";

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
