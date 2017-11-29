#!/usr/bin/env node

import parse from "./parse";
import getStdin from "get-stdin";

getStdin()
  .then(async str => {
    const output = await parse(
      process.argv.slice(2),
      str.replace(/\n$/, "").split("\n")
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
    console.error(error.message);
    process.exit(1);
  });
