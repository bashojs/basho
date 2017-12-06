import child_process from "child_process";
import promisify from "nodefunc-promisify";
import path from "path";

function execute(cmd) {
  return new Promise((resolve, reject) => {
    const child = child_process.exec(cmd, (err, result) => {
      resolve(result);
    });
    child.stdin.end();
  });
}

const basho = `node ${path.resolve("./dist/basho.js")}`;

export default function run() {
  describe("basho", () => {
    it(`Prints a number (shell)`, async () => {
      const output = await execute(`${basho} -j 10`);
      output.should.equal("10\n");
    });
  
    it(`Prints a numeric expression (shell)`, async () => {
      const output = await execute(`${basho} -j 10**2`);
      output.should.equal("100\n");
    });
  
    it(`Prints a boolean (shell)`, async () => {
      const output = await execute(`${basho} -j true`);
      output.should.equal("true\n");
    });
  
    it(`Evals a template string (shell)`, async () => {
      const output = await execute(`${basho} 10 -j \\\`number:\\\${x}\\\``);
      output.should.equal("number:10\n");
    });
  
    it(`Works with an array (shell)`, async () => {
      const output = await execute(`${basho} [1,2,3,4] -j x+10`);
      output.should.equal("11\n12\n13\n14\n");
    });
  
    it(`Prints a number without the -j option (shell)`, async () => {
      const output = await execute(`${basho} 10`);
      output.should.equal("10\n");
    });
  
    it(`Prints a numeric expression without the -j option (shell)`, async () => {
      const output = await execute(`${basho} 10**2`);
      output.should.equal("100\n");
    });
  
    it(`Prints a boolean without the -j option (shell)`, async () => {
      const output = await execute(`${basho} true`);
      output.should.equal("true\n");
    });
  
    it(`Prints a string value (shell)`, async () => {
      const output = await execute(`${basho} '"hello, world"'`);
      output.should.equal("hello, world\n");
    });
  
    it(`Prints a quoted string (shell)`, async () => {
      const output = await execute(`${basho} -q hello, world`);
      output.should.equal("hello, world\n");
    });
  
    it(`Pipes to the next expression (shell)`, async () => {
      const output = await execute(`${basho} 100 -j x**2`);
      output.should.equal("10000\n");
    });
  
    it(`Prints a string via shell echo (shell)`, async () => {
      const output = await execute(`${basho} 10 -e 'echo \${x}'`);
      output.should.equal("10\n");
    });
  
    it(`Evals and logs an expression (shell)`, async () => {
      const output = await execute(`${basho} 10 -l x+11 -j x -e 'echo \${x}'`);
      output.should.equal("21\n10\n");
    });
  
    it(`Evals and writes an expression (shell)`, async () => {
      const output = await execute(`${basho} 10 -w x+11 -j x -e 'echo \${x}'`);
      output.should.equal("2110\n");
    });
  
    it(`Imports a file (shell)`, async () => {
      const output = await execute(
        `${basho} 10 -i ./dist/test/square.js sqr -j 'sqr(x)'`
      );
      output.should.equal("100\n");
    });
  
    it(`Imports a file (shell), reuse import multiple times (shell)`, async () => {
      const output = await execute(
        `${
          basho
        } 10 -i ./dist/test/square.js sqr -j 'sqr(x)' -j x+100 -j 'sqr(x)'`
      );
      output.should.equal("40000\n");
    });
  
    it(`Can accept a piped argument (shell)`, async () => {
      const output = await execute(`echo 10 | ${basho} -e 'echo \${x}'`);
      output.should.equal("10\n");
    });
  
    it(`Calls a subsequent expression for each array item (shell)`, async () => {
      const output = await execute(`${basho} [1,2,3,4] -e 'echo N\${x}'`);
      output.should.equal("N1\nN2\nN3\nN4\n");
    });
  
    it(`Handles objects (shell)`, async () => {
      const output = await execute(
        `${basho} '{ name: "jes", age: 100 }' -e 'echo \${x.name}, \${x.age}'`
      );
      output.should.equal("jes, 100\n");
    });
  
    it(`Handles an array of Objects (shell)`, async () => {
      const output = await execute(
        `${basho} '[{name: "kai"}, {name:"niki"}]' -e 'echo \${x.name}'`
      );
      output.should.equal("kai\nniki\n");
    });
  
    it(`Handles an array of arrays (shell)`, async () => {
      const output = await execute(
        `${basho} '[[1,2,3], [3,4,5]]' -e 'echo \${x[0]} \${x[1]} \${x[2]}'`
      );
      output.should.equal("1 2 3\n3 4 5\n");
    });
  
    it(`Removes an expression result from the pipeline (shell)`, async () => {
      const output = await execute(`${basho} 10 -j x+1 -j x+2 -j x+3 -d -d`);
      output.should.equal("11\n");
    });
  
    it(`Receives an array at once (shell)`, async () => {
      const output = await execute(
        `${basho} [1,2,3,4] -a x.length -e 'echo \${x}'`
      );
      output.should.equal("4\n");
    });
  
    it(`Filters an array (shell)`, async () => {
      const output = await execute(
        `${basho} [1,2,3,4] -f 'x\>2' -e 'echo \${x}'`
      );
      output.should.equal("3\n4\n");
    });
  
    it(`Reduces an array (shell)`, async () => {
      const output = await execute(
        `${basho} [1,2,3,4] -r acc+x 0 -e 'echo \${x}'`
      );
      output.should.equal("10\n");
    });
  
    it(`Flatmaps (shell)`, async () => {
      const output = await execute(
        `${basho} [1,2,3] -m [x+10, x+20] -e 'echo \${x}'`
      );
      output.should.equal("11\n21\n12\n22\n13\n23\n");
    });
  
    it(`Can access array indexes (shell)`, async () => {
      const output = await execute(
        `${basho} '["a","b","c"]' -e 'echo \${x}\${i}'`
      );
      output.should.equal("a0\nb1\nc2\n");
    });
  
    it(`Can extend the pipeline further after a shell command (shell)`, async () => {
      const output = await execute(
        `${basho} 10 -j x**2 -e 'echo \${x}' -j 'parseInt(x)+10' -e 'echo \${x}'`
      );
      output.should.equal("110\n");
    });
  
    it(`Plays well with shell pipelines (shell)`, async () => {
      const output = await execute(`${basho} 10 -j x**2 | xargs echo`);
      output.should.equal("100\n");
    });
  
    it(`Resolves promises (shell)`, async () => {
      const output = await execute(`${basho} 'Promise.resolve(10)' -j x+10`);
      output.should.equal("20\n");
    });
  
    it(`Can reference the result stack (shell)`, async () => {
      const output = await execute(
        `${basho} [10,20,30,40] -j x+1 -j x+2 --stack 2 -j x`
      );
      output.should.equal("10\n20\n30\n40\n");
    });
  
    it(`Terminates based on a predicate (shell)`, async () => {
      const output = await execute(`${basho} '[1,2,3,4]' -t 'x>2' -j 'x*10'`);
  
      output.should.equal("10\n20\n");
    });
  
    it(`Terminates based on a predicate with Promises in the pipeline (shell)`, async () => {
      const output = await execute(
        `${basho} '[Promise.resolve(1),2,3,4]' -t 'x>2' -j 'x*10'`
      );
  
      output.should.equal("10\n20\n");
    });
  
    it(`Creates a named result but does not seek (shell)`, async () => {
      const output = await execute(
        `${basho} [10,20,30,40] -j x+1 -j x+2 -n add2 -j x+10`
      );
  
      output.should.equal("23\n33\n43\n53\n");
    });
  
    it(`Creates a named result and seeks (shell)`, async () => {
      const output = await execute(
        `${basho} [10,20,30,40] -j x+1 -j x+2 -n add2 -j x*100 -s add2 -j x+10`
      );
  
      output.should.equal("23\n33\n43\n53\n");
    });
  
    it(`Combines named results (shell)`, async () => {
      const output = await execute(
        `${basho} [10,20,30,40] -j x+1 -n add1 -j x+2 -n add2 -c add1,add2`
      );
  
      output.should.equal("[ 11, 13 ]\n[ 21, 23 ]\n[ 31, 33 ]\n[ 41, 43 ]\n");
    });
  
    it(`Captures an error (shell)`, async () => {
      const output = await execute(
        `${basho} '["a,b", 10, "c,d"]' -j 'x.split(",")' --error '"skipped"'`
      );
  
      output.should.equal("[ 'a', 'b' ]\nskipped\n[ 'c', 'd' ]\n");
    });

    it(`Does not exit with the ignoreerror option (shell)`, async () => {
      const output = await execute(
        `${basho} --ignoreerror '["a,b", 10, "c,d"]' -j 'x.split(",")'`
      );
  
      output.should.equal("[ 'a', 'b' ]\n[ 'c', 'd' ]\n");
    });

    it(`Prints error and does not exit with the printerror option (shell)`, async () => {
      const output = await execute(
        `${basho} --printerror '["a,b", 10, "c,d"]' -j 'x.split(",")'`
      );
  
      output.should.equal("[ 'a', 'b' ]\nbasho failed to evaluate expression: x.split(\",\").\n[ 'c', 'd' ]\n");
    });
  
    it(`Prints the correct version with -v`, async () => {
      const packageJSON = require("../../package.json");
      const output = await execute(`${basho} "-v"`);
      output.should.equal(`${packageJSON.version}\n`);
    });
  
    it(`Prints the correct version with --version`, async () => {
      const packageJSON = require("../../package.json");
      const output = await execute(`${basho} "--version"`);
      output.should.equal(`${packageJSON.version}\n`);
    });
  });
  
}