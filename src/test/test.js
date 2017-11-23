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

  it(`Calls a named export from an external file`, async () => {
    const result = await parse([
      "10",
      "-i",
      "./dist/test/square.js",
      "squareAlias"
    ]);
    result.should.deepEqual({ mustPrint: false, result: 100 });
  });

  it(`Calls a bash command`, async () => {
    const result = await parse(["10", "x**2", "-e", "echo ${x}"]);
    result.should.deepEqual({ mustPrint: false, result: "100" });
  });

  it(`Can extend the pipeline beyond the bash command`, async () => {
    const result = await parse([
      "10",
      "x**2",
      "-e",
      "echo ${x}",
      "`The answer is ${x}`"
    ]);
    result.should.deepEqual({ mustPrint: false, result: "The answer is 100" });
  });
});
