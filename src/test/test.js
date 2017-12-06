import "babel-polyfill";
import should from "should";
import sourceMapSupport from "source-map-support";
import basicTests from "./basic-tests";

sourceMapSupport.install();

basicTests()