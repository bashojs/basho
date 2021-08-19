import "../preload.js";
import "mocha";
import "should";
import child_process from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function execute(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = child_process.exec(cmd, (err: any, result: any) => {
      resolve(result);
    });
    if (child.stdin) {
      child.stdin.end();
    } else {
      throw new Error("Unable to access stdin within test process.");
    }
  });
}

function spawn(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(cmd, args);
    child.stdin.end();
    child.stdout.on("data", (data) => resolve(data.toString()));
  });
}

const script = path.join(__dirname, "../index.js");
const basho = `node ${script}`;

describe("basho", () => {
  it(`Prints a number`, async () => {
    const output = await execute(`${basho} -j 10`);
    output.should.equal("10\n");
  });

  it(`Prints a numeric expression`, async () => {
    const output = await execute(`${basho} -j 10**2`);
    output.should.equal("100\n");
  });

  it(`Prints a boolean`, async () => {
    const output = await execute(`${basho} -j true`);
    output.should.equal("true\n");
  });

  it(`Evals a template string`, async () => {
    const output = await execute(`${basho} 10 -j \\\`number:\\\${x}\\\``);
    output.should.equal("number:10\n");
  });

  it(`Works with an array`, async () => {
    const output = await execute(`${basho} [1,2,3,4] -j x+10`);
    output.should.equal("11\n12\n13\n14\n");
  });

  it(`Prints a number without the -j option`, async () => {
    const output = await execute(`${basho} 10`);
    output.should.equal("10\n");
  });

  it(`Prints a numeric expression without the -j option`, async () => {
    const output = await execute(`${basho} 10**2`);
    output.should.equal("100\n");
  });

  it(`Prints a boolean without the -j option`, async () => {
    const output = await execute(`${basho} true`);
    output.should.equal("true\n");
  });

  it(`Prints a string value`, async () => {
    const output = await execute(`${basho} '"hello, world"'`);
    output.should.equal("hello, world\n");
  });

  it(`Pipes to the next expression`, async () => {
    const output = await execute(`${basho} 100 -j x**2`);
    output.should.equal("10000\n");
  });

  it(`Prints a string via shell echo`, async () => {
    const output = await execute(`${basho} 10 -e 'echo \${x}'`);
    output.should.equal("10\n");
  });

  it(`Escapes a string`, async () => {
    const output = await execute(`${basho} '"hello, world"' -e 'echo \${x}'`);
    output.should.equal("hello, world\n");
  });

  it(`Evals and logs an expression`, async () => {
    const output = await execute(`${basho} 10 -l x+11 -j x -e 'echo \${x}'`);
    output.should.equal("21\n10\n");
  });

  it(`Evals and writes an expression`, async () => {
    const output = await execute(`${basho} 10 -w x+11 -j x -e 'echo \${x}'`);
    output.should.equal("2110\n");
  });

  it(`Imports a file`, async () => {
    const output = await execute(
      `${basho} 10 --import ./dist/test/square.cjs sqr -j 'sqr(x)'`
    );
    output.should.equal("100\n");
  });

  it(`Imports a file (shell), reuse import multiple times`, async () => {
    const output = await execute(
      `${basho} 10 --import ./dist/test/square.cjs sqr -j 'sqr(x)' -j x+100 -j 'sqr(x)'`
    );
    output.should.equal("40000\n");
  });

  it(`Can accept a piped argument`, async () => {
    const output = await execute(`echo 10 | ${basho} -e 'echo \${x}'`);
    output.should.equal("10\n");
  });

  it(`Can accept a multi-line piped argument`, async () => {
    const output = await execute(`printf "10\n20" | ${basho} -e 'echo \${x}'`);
    output.should.equal("10\n20\n");
  });

  it(`Calls a subsequent expression for each array item`, async () => {
    const output = await execute(`${basho} [1,2,3,4] -e 'echo N\${x}'`);
    output.should.equal("N1\nN2\nN3\nN4\n");
  });

  it(`Handles objects`, async () => {
    const output = await execute(
      `${basho} '{ name: "jes", age: 100 }' -e 'echo \${x.name}, \${x.age}'`
    );
    output.should.equal("jes, 100\n");
  });

  it(`Handles an array of Objects`, async () => {
    const output = await execute(
      `${basho} '[{name: "kai"}, {name:"niki"}]' -e 'echo \${x.name}'`
    );
    output.should.equal("kai\nniki\n");
  });

  it(`Handles an array of arrays`, async () => {
    const output = await execute(
      `${basho} '[[1,2,3], [3,4,5]]' -e 'echo \${x[0]} \${x[1]} \${x[2]}'`
    );
    output.should.equal("1 2 3\n3 4 5\n");
  });

  it(`Receives an array at once`, async () => {
    const output = await execute(
      `${basho} [1,2,3,4] -a -j x.length -e 'echo \${x}'`
    );
    output.should.equal("4\n");
  });

  it(`Treats the entire input as a string`, async () => {
    const echoProcess = child_process.spawn("echo", [
      "-e",
      '{\n "a": 1,\n "b": 2\n }',
    ]);

    const bashoProcess = child_process.spawn("node", [
      script,
      "--str",
      "-j",
      "JSON.parse(x).a",
    ]);

    echoProcess.stdout.pipe(bashoProcess.stdin);

    const output = await new Promise<string>((resolve) =>
      bashoProcess.stdout.on("data", (x) => resolve(x.toString()))
    );

    output.should.equal("1\n");
  });

  it(`Treats the input as json`, async () => {
    const echoProcess = child_process.spawn("echo", [
      "-e",
      '{\n "a": 1,\n "b": 2\n }',
    ]);

    const bashoProcess = child_process.spawn("node", [
      script,
      "--json",
      "-j",
      "x.a",
    ]);

    echoProcess.stdout.pipe(bashoProcess.stdin);

    const output = await new Promise<string>((resolve) =>
      bashoProcess.stdout.on("data", (x) => resolve(x.toString()))
    );

    output.should.equal("1\n");
  });

  it(`Filters an array`, async () => {
    const output = await execute(
      `${basho} [1,2,3,4] -f 'x\>2' -e 'echo \${x}'`
    );
    output.should.equal("3\n4\n");
  });

  it(`Reduces an array`, async () => {
    const output = await execute(
      `${basho} [1,2,3,4] -r acc+x 0 -e 'echo \${x}'`
    );
    output.should.equal("10\n");
  });

  it(`Flatmaps`, async () => {
    const output = await execute(
      `${basho} [1,2,3] -m '[x+10, x+20]' -e 'echo \${x}'`
    );
    output.should.equal("11\n21\n12\n22\n13\n23\n");
  });

  it(`Can access array indexes`, async () => {
    const output = await execute(
      `${basho} '["a","b","c"]' -e 'echo \${x}\${i}'`
    );
    output.should.equal("a0\nb1\nc2\n");
  });

  it(`Can extend the pipeline further after a shell command`, async () => {
    const output = await execute(
      `${basho} 10 -j x**2 -e 'echo \${x}' -j 'parseInt(x)+10' -e 'echo \${x}'`
    );
    output.should.equal("110\n");
  });

  it(`Plays well with shell pipelines`, async () => {
    const output = await execute(`${basho} 10 -j x**2 | xargs echo`);
    output.should.equal("100\n");
  });

  it(`Resolves promises`, async () => {
    const output = await execute(`${basho} 'Promise.resolve(10)' -j x+10`);
    output.should.equal("20\n");
  });

  it(`Terminates based on a predicate`, async () => {
    const output = await execute(`${basho} '[1,2,3,4]' -t 'x>2' -j 'x*10'`);

    output.should.equal("10\n20\n");
  });

  it(`Terminates based on a predicate with Promises in the pipeline`, async () => {
    const output = await execute(
      `${basho} '[Promise.resolve(1),2,3,4]' -t 'x>2' -j 'x*10'`
    );

    output.should.equal("10\n20\n");
  });

  it(`Can define a reusable expression`, async () => {
    const output = await execute(
      `${basho} -d onehundred 100 -j 'k.onehundred'`
    );

    output.should.equal("100\n");
  });

  it(`Can use a reusable expression in a JS Expression`, async () => {
    const output = await execute(
      `${basho} '[10,11,12]' -d add1 'x=>x+1' -j 'k.add1(x)'`
    );

    output.should.equal("11\n12\n13\n");
  });

  it(`Can use a reusable expression in a Shell Command`, async () => {
    const output = await execute(
      `${basho} [10,11,12] -d ECHO_CMD '"echo"' -e '\${k.ECHO_CMD} N\${x}'`
    );

    output.should.equal("N10\nN11\nN12\n");
  });

  it(`Works with a subroutine`, async () => {
    const output = await execute(
      `${basho} [10,11,12] --sub multiply 'x*10' --endsub -j 'k.multiply(x)'`
    );

    output.should.equal("100\n110\n120\n");
  });

  it(`Works with a multi-step subroutine`, async () => {
    const output = await execute(
      `${basho} [10,11,12] --sub multiply 'x*10' -j 'x*10' --endsub -j 'k.multiply(x)'`
    );

    output.should.equal("1000\n1100\n1200\n");
  });

  it(`Works with nested subroutines`, async () => {
    const output = await execute(
      `${basho} [10,11,12] \
        --sub multiply \
          --sub square 'x*x' --endsub \
          -j 'x*10' -j 'k.square(x)' \
        --endsub \
        -j 'k.multiply(x)'`
    );

    output.should.equal("10000\n12100\n14400\n");
  });

  it(`Creates a named stage`, async () => {
    const output = await execute(
      `${basho} [10,20,30,40] -j x+1 -j x+2 -n add2 -j x+10`
    );

    output.should.equal("23\n33\n43\n53\n");
  });

  it(`Combines named stages`, async () => {
    const output = await execute(
      `${basho} [10,20,30,40] -j x+1 -n add1 -j x+2 -n add2 -c add1,add2`
    );

    output.should.equal("[ 11, 13 ]\n[ 21, 23 ]\n[ 31, 33 ]\n[ 41, 43 ]\n");
  });

  it(`Seeks named stages`, async () => {
    const output = await execute(
      `${basho} [10,20,30,40] -j x+1 -n add1 -j x+2 -n add2 -s add1`
    );

    output.should.equal("11\n21\n31\n41\n");
  });

  it(`Captures an error`, async () => {
    const output = await execute(
      `${basho} '["a,b", 10, "c,d"]' -j 'x.split(",")' --error '"skipped"'`
    );

    output.should.equal("[ 'a', 'b' ]\nskipped\n[ 'c', 'd' ]\n");
  });

  it(`Does not exit with the ignoreerror option`, async () => {
    const output = await execute(
      `${basho} --ignoreerror '["a,b", 10, "c,d"]' -j 'x.split(",")'`
    );

    output.should.equal("[ 'a', 'b' ]\n[ 'c', 'd' ]\n");
  });

  it(`Prints error and does not exit with the printerror option`, async () => {
    const output = await execute(
      `${basho} --printerror '["a,b", 10, "c,d"]' -j 'x.split(",")'`
    );

    output.should.equal(
      `[ \'a\', \'b\' ]\nFailed to evaluate expression: x.split(",").\nTypeError: x.split is not a function\n[ \'c\', \'d\' ]\n`
    );
  });

  it(`Prints the correct version with -v`, async () => {
    const pkg = path.join(__dirname, "../../package.json");
    const packageJSON = JSON.parse(fs.readFileSync(pkg, "utf8"));
    const output = await execute(`${basho} "-v"`);
    output.should.equal(`${packageJSON.version}\n`);
  });

  it(`Prints the correct version with --version`, async () => {
    const pkg = path.join(__dirname, "../../package.json");
    const packageJSON = JSON.parse(fs.readFileSync(pkg, "utf8"));
    const output = await execute(`${basho} "--version"`);
    output.should.equal(`${packageJSON.version}\n`);
  });

  it(`Recurses`, async () => {
    const output = await execute(
      `${basho} [20] -j x+1 -n add1 -j x+2 -g add1 'x<30'`
    );

    output.should.equal("32\n");
  });

  it(`Recurses with multiple inputs`, async () => {
    const output = await execute(
      `${basho} 25 -j x+100 -n add1 -g add1 'x<1000'`
    );
    output.should.equal("1025\n");
  });

  it(`Recurses with multiple inputs`, async () => {
    const output = await execute(
      `${basho} [14,20,30] -j x+1 -n add1 -j x+2 -g add1 'x<30'`
    );
    output.should.equal("32\n32\n33\n");
  });

  it(`Computes Fibonacci Series`, async () => {
    const output = await execute(
      `${basho} [[[0],1]] -j '[x[0].concat(x[1]), x[0].slice(-1)[0] + x[1]]' -n fib -g fib 'x[1]<300' -j x[0]`
    );
    output.should.equal(
      "[\n    0,   1,  1,  2,  3,  5,\n    8,  13, 21, 34, 55, 89,\n  144, 233\n]\n"
    );
  });

  it(`Multi-line args`, async () => {
    const expression = `
      -j
        20
      -j
        x === 10 ? 100 : 200
    `;
    const output = await spawn("node", [script, expression]);
    output.should.equal("200\n");
  });

  it(`Multi-line args with brackets`, async () => {
    const expression = `
      -j
        20
      -j
        (
          x === 10
            ? 100
            : 200
        )
    `;
    const output = await spawn("node", [script, expression]);
    output.should.equal("200\n");
  });

  it(`Shows an error if bracket is not closed`, async () => {
    const expression = `
      -j
        20
      -j
        (
          x === 10
            ? 100
            : 200
    `;
    const output = await spawn("node", [script, expression]);
    output.should.equal("Bracket started after '-j' was not closed.\n");
  });
});
