import should from "should";
import * as babel from "babel-core";
import sourceMapSupport from "source-map-support";
import parse from "../parse";

sourceMapSupport.install();

describe("bashfury", () => {
  it(`Evals a constant`, async () => {
    const result = await parse(["1"]);
    result.should.deepEqual({ mustPrint: false, result: 1 });
  });

  it(`Evals a promise`, async () => {
    const result = await parse(["Promise.resolve(1)"]);
    result.should.deepEqual({ mustPrint: false, result: 1 });
  });

  it(`Evals a array`, async () => {
    const result = await parse(["[1,2,3,4]"]);
    result.should.deepEqual({ mustPrint: false, result: [1, 2, 3, 4] });
  });

  it(`Evals an object`, async () => {
    const result = await parse(["{ name: 'kai' }"]);
    result.should.deepEqual({ mustPrint: false, result: { name: "kai" } });
  });

  it(`Evals an array of objects`, async () => {
    const result = await parse(["[{ name: 'kai' }, { name: 'niki' }]"]);
    result.should.deepEqual({ mustPrint: false, result: [{ name: "kai" }, { name: "niki" }] });
  });

  it(`Sets the mustPrint flag`, async () => {
    const result = await parse(["-p", "[1,2,3,4]"]);
    result.should.deepEqual({ mustPrint: true, result: [1, 2, 3, 4] });
  });

  it(`Pipes a result into the next expression`, async () => {
    const result = await parse(["[1,2,3,4]", "x**2"]);
    result.should.deepEqual({ mustPrint: false, result: [1, 4, 9, 16] });
  });

  it(`Passes an array as whole with the -a option`, async () => {
    const result = await parse(["[1,2,3,4]", "-a", "x.length"]);
    result.should.deepEqual({ mustPrint: false, result: 4 });
  });

  it(`Filters an array`, async () => {
    const result = await parse(["[1,2,3,4]", "-f", "x > 2"]);
    result.should.deepEqual({ mustPrint: false, result: [3, 4] });
  });

  it(`Reduces an array`, async () => {
    const result = await parse(["[1,2,3,4]", "-r", "acc + x", "0"]);
    result.should.deepEqual({ mustPrint: false, result: 10 });
  });

  it(`Calls a function in an external file`, async () => {
    const result = await parse(["10", "./dist/test/square.js"]);
    result.should.deepEqual({ mustPrint: false, result: 100 });
  });

  it(`Calls a function exported with module.exports`, async () => {
    const result = await parse(["10", "./dist/test/square-node.js"]);
    result.should.deepEqual({ mustPrint: false, result: 100 });
  });

  it(`Calls a named export from an external file`, async () => {
    const result = await parse([
      "10",
      "-i",
      "./dist/test/square.js",
      "squareAlias"
    ]);
    result.should.deepEqual({ mustPrint: false, result: 100 });
  });

  it(`Calls a shell command`, async () => {
    const result = await parse(["10", "-e", "echo ${x}"]);
    result.should.deepEqual({ mustPrint: false, result: "10" });
  });

  it(`Passes an object to a shell command`, async () => {
    const result = await parse(["{ name: 'kai' }", "-e", "echo ${x.name}"]);
    result.should.deepEqual({ mustPrint: false, result: "kai" });
  });

  it(`Calls a shell command which outputs multiple lines`, async () => {
    const result = await parse(["10", "-e", "echo ${x};echo ${x};"]);
    result.should.deepEqual({ mustPrint: false, result: ["10", "10"] });
  });

  it(`Calls a shell command which outputs newlines`, async () => {
    const result = await parse(["10", "-e", 'echo "${x}\n${x}"']);
    result.should.deepEqual({ mustPrint: false, result: ["10", "10"] });
  });

  it(`Passes an array to a shell command`, async () => {
    const result = await parse(["[10, 11, 12]", "-e", "echo N${x}"]);
    result.should.deepEqual({
      mustPrint: false,
      result: ["N10", "N11", "N12"]
    });
  });

  it(`Passes the output of the shell command output to the next expression`, async () => {
    const result = await parse(["-e", "echo 10", "`The answer is ${x}`"]);
    result.should.deepEqual({ mustPrint: false, result: "The answer is 10" });
  });

  it(`Passes multiline output of the shell command output to the next expression`, async () => {
    const result = await parse(["-e", 'echo "10\n10"', "`The answer is ${x}`"]);
    result.should.deepEqual({
      mustPrint: false,
      result: ["The answer is 10", "The answer is 10"]
    });
  });
});
