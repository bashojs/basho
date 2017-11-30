import should from "should";
import child_process from "child_process";
import promisify from "nodefunc-promisify";
import sourceMapSupport from "source-map-support";
import parse from "../parse";
import path from "path";
import { log } from "util";

sourceMapSupport.install();

function execute(cmd) {
  return new Promise((resolve, reject) => {
    const child = child_process.exec(cmd, (err, result) => {
      resolve(result);
    });
    child.stdin.end();
  });
}

const basho = `node ${path.resolve("./dist/basho.js")}`;

describe("basho", () => {
  it(`Evals a number`, async () => {
    const result = await parse(["1"]);
    result.should.deepEqual({ mustPrint: true, result: 1 });
  });

  it(`Evals a bool`, async () => {
    const result = await parse(["true"]);
    result.should.deepEqual({ mustPrint: true, result: true });
  });

  it(`Evals a string`, async () => {
    const result = await parse(['"hello, world"']);
    result.should.deepEqual({ mustPrint: true, result: "hello, world" });
  });

  it(`Evals a template string`, async () => {
    const result = await parse(["10", "-j", "`number:${x}`"]);
    result.should.deepEqual({ mustPrint: true, result: "number:10" });
  });

  it(`Quotes a string`, async () => {
    const result = await parse(["-q", "hello, world"]);
    result.should.deepEqual({ mustPrint: true, result: "hello, world" });
  });

  it(`Quotes an array of strings`, async () => {
    const result = await parse(["-q", "hello,", "world"]);
    result.should.deepEqual({ mustPrint: true, result: "hello, world" });
  });

  it(`Evals a promise`, async () => {
    const result = await parse(["Promise.resolve(1)"]);
    result.should.deepEqual({ mustPrint: true, result: 1 });
  });

  it(`Evals an array`, async () => {
    const result = await parse(["[1,2,3,4]"]);
    result.should.deepEqual({ mustPrint: true, result: [1, 2, 3, 4] });
  });

  it(`Evals an object`, async () => {
    const result = await parse(["{ name: 'kai' }"]);
    result.should.deepEqual({ mustPrint: true, result: { name: "kai" } });
  });

  it(`Evals an array of objects`, async () => {
    const result = await parse(["[{ name: 'kai' }, { name: 'niki' }]"]);
    result.should.deepEqual({
      mustPrint: true,
      result: [{ name: "kai" }, { name: "niki" }]
    });
  });

  it(`Unset the mustPrint flag`, async () => {
    const result = await parse(["-p", "[1,2,3,4]"]);
    result.should.deepEqual({ mustPrint: false, result: [1, 2, 3, 4] });
  });

  it(`Pipes a result into the next expression`, async () => {
    const result = await parse(["[1,2,3,4]", "-j", "x**2"]);
    result.should.deepEqual({ mustPrint: true, result: [1, 4, 9, 16] });
  });

  it(`Passes an array as whole with the -a option`, async () => {
    const result = await parse(["[1,2,3,4]", "-a", "x.length"]);
    result.should.deepEqual({ mustPrint: true, result: 4 });
  });

  it(`Filters an array`, async () => {
    const result = await parse(["[1,2,3,4]", "-f", "x > 2"]);
    result.should.deepEqual({ mustPrint: true, result: [3, 4] });
  });

  it(`Reduces an array`, async () => {
    const result = await parse(["[1,2,3,4]", "-r", "acc + x", "0"]);
    result.should.deepEqual({ mustPrint: true, result: 10 });
  });

  it(`Calls a function in an external file`, async () => {
    const result = await parse([
      "10",
      "-i",
      "./dist/test/square.js",
      "sqr",
      "-j",
      "sqr(x)"
    ]);
    debugger;
    result.should.deepEqual({ mustPrint: true, result: 100 });
  });

  it(`Calls a node module`, async () => {
    const result = await parse([
      `["/a", "b", "c"]`,
      "-a",
      "-i",
      "path",
      "path",
      "-j",
      "path.join.apply(path, x)"
    ]);
    result.should.deepEqual({ mustPrint: true, result: "/a/b/c" });
  });

  it(`Calls a shell command`, async () => {
    const result = await parse(["10", "-e", "echo ${x}"]);
    result.should.deepEqual({ mustPrint: true, result: "10" });
  });

  it(`Passes an object to a shell command`, async () => {
    const result = await parse(["{ name: 'kai' }", "-e", "echo ${x.name}"]);
    result.should.deepEqual({ mustPrint: true, result: "kai" });
  });

  it(`Calls a shell command which outputs multiple lines`, async () => {
    const result = await parse(["10", "-e", "echo ${x};echo ${x};"]);
    result.should.deepEqual({ mustPrint: true, result: ["10", "10"] });
  });

  it(`Calls a shell command which outputs newlines`, async () => {
    const result = await parse(["10", "-e", 'echo "${x}\n${x}"']);
    result.should.deepEqual({ mustPrint: true, result: ["10", "10"] });
  });

  it(`Passes an array to a shell command`, async () => {
    const result = await parse(["[10, 11, 12]", "-e", "echo N${x}"]);
    result.should.deepEqual({
      mustPrint: true,
      result: ["N10", "N11", "N12"]
    });
  });

  it(`Passes the output of the shell command output to the next expression`, async () => {
    const result = await parse(["-e", "echo 10", "-j", "`The answer is ${x}`"]);
    result.should.deepEqual({ mustPrint: true, result: "The answer is 10" });
  });

  it(`Passes multiline output of the shell command output to the next expression`, async () => {
    const result = await parse([
      "-e",
      'echo "10\n10"',
      "-j",
      "`The answer is ${x}`"
    ]);
    result.should.deepEqual({
      mustPrint: true,
      result: ["The answer is 10", "The answer is 10"]
    });
  });

  it(`Prints a number (shell)`, async () => {
    const result = await execute(`${basho} -j 10`);
    result.should.equal("10\n");
  });

  it(`Prints a numeric expression (shell)`, async () => {
    const result = await execute(`${basho} -j 10**2`);
    result.should.equal("100\n");
  });

  it(`Prints a boolean (shell)`, async () => {
    const result = await execute(`${basho} -j true`);
    result.should.equal("true\n");
  });

  it(`Evals a template string (shell)`, async () => {
    const result = await execute(`${basho} 10 -j \\\`number:\\\${x}\\\``);
    result.should.equal("number:10\n");
  });

  it(`Works with an array (shell)`, async () => {
    const result = await execute(`${basho} [1,2,3,4] -j x+10`);
    result.should.equal("11\n12\n13\n14\n");
  });

  it(`Prints a number without the -j option (shell)`, async () => {
    const result = await execute(`${basho} 10`);
    result.should.equal("10\n");
  });

  it(`Prints a numeric expression without the -j option (shell)`, async () => {
    const result = await execute(`${basho} 10**2`);
    result.should.equal("100\n");
  });

  it(`Prints a boolean without the -j option (shell)`, async () => {
    const result = await execute(`${basho} true`);
    result.should.equal("true\n");
  });

  it(`Prints a string value (shell)`, async () => {
    const result = await execute(`${basho} '"hello, world"'`);
    result.should.equal("hello, world\n");
  });

  it(`Prints a quoted string (shell)`, async () => {
    const result = await execute(`${basho} -q hello, world`);
    result.should.equal("hello, world\n");
  });

  it(`Pipes to the next expression (shell)`, async () => {
    const result = await execute(`${basho} 100 -j x**2`);
    result.should.equal("10000\n");
  });

  it(`Prints a string via shell echo (shell)`, async () => {
    const result = await execute(`${basho} 10 -e echo \\\${x}`);
    result.should.equal("10\n");
  });

  it(`Imports a file (shell)`, async () => {
    const result = await execute(
      `${basho} 10 -i ./dist/test/square.js sqr -j "sqr(x)"`
    );
    result.should.equal("100\n");
  });

  it(`Imports a file (shell), reuse import multiple times (shell)`, async () => {
    const result = await execute(
      `${
        basho
      } 10 -i ./dist/test/square.js sqr -j "sqr(x)" -j x+100 -j "sqr(x)"`
    );
    result.should.equal("40000\n");
  });

  it(`Can accept a piped argument (shell)`, async () => {
    const result = await execute(`echo 10 | ${basho} -e echo \\\${x}`);
    result.should.equal("10\n");
  });

  it(`Calls a subsequent expression for each array item (shell)`, async () => {
    const result = await execute(`${basho} [1,2,3,4] -e echo N\\\${x}`);
    result.should.equal("N1\nN2\nN3\nN4\n");
  });

  it(`Handles objects (shell)`, async () => {
    const result = await execute(
      `${basho} "{ name: 'jes', age: 100 }" -e echo \\\${x.name}, \\\${x.age}`
    );
    result.should.equal("jes, 100\n");
  });

  it(`Handles an array of Objects (shell)`, async () => {
    const result = await execute(
      `${basho} "[{name:'kai'}, {name:'niki'}]" -e echo \\\${x.name}`
    );
    result.should.equal("kai\nniki\n");
  });

  it(`Handles an array of arrays (shell)`, async () => {
    const result = await execute(
      `${basho} "[[1,2,3], [3,4,5]]" -e echo \\\${x[0]} \\\${x[1]} \\\${x[2]}`
    );
    result.should.equal("1 2 3\n3 4 5\n");
  });

  it(`Receives an array at once (shell)`, async () => {
    const result = await execute(
      `${basho} [1,2,3,4] -a x.length -e echo \\\${x}`
    );
    result.should.equal("4\n");
  });

  it(`Filters an array (shell)`, async () => {
    const result = await execute(
      `${basho} [1,2,3,4] -a "x.filter(x => x > 2)" -e echo \\\${x}`
    );
    result.should.equal("3\n4\n");
  });

  it(`Filters an array shorthand (shell)`, async () => {
    const result = await execute(
      `${basho} [1,2,3,4] -f "x\>2" -e echo \\\${x}`
    );
    result.should.equal("3\n4\n");
  });

  it(`Reduces an array (shell)`, async () => {
    const result = await execute(
      `${basho} [1,2,3,4] -a "x.reduce((acc,x)=>acc+x,0)" -e echo \\\${x}`
    );
    result.should.equal("10\n");
  });

  it(`Reduces an array shorthand (shell)`, async () => {
    const result = await execute(
      `${basho} [1,2,3,4] -r acc+x 0 -e echo \\\${x}`
    );
    result.should.equal("10\n");
  });

  it(`Can access array indexes (shell)`, async () => {
    const result = await execute(
      `${basho} "['a','b','c']" -e echo \\\${x}\\\${i}`
    );
    result.should.equal("a0\nb1\nc2\n");
  });

  it(`Can extend the pipeline further after a shell command (shell)`, async () => {
    const result = await execute(
      `${basho} 10 -j x**2 -e echo \\\${x} -j "parseInt(x)+10" -e echo \\\${x}`
    );
    result.should.equal("110\n");
  });

  it(`Plays well with shell pipelines (shell)`, async () => {
    const result = await execute(`${basho} 10 -j x**2 | xargs echo`);
    result.should.equal("100\n");
  });

  it(`Resolves promises (shell)`, async () => {
    const result = await execute(`${basho} "Promise.resolve(10)" -j x+10`);
    result.should.equal("20\n");
  });

  it(`Prints the correct version`, async () => {
    const packageJSON = require("../../package.json");
    const result = await execute(`${basho} "-v"`);
    result.should.equal(`${packageJSON.version}\n`);
  });
});
