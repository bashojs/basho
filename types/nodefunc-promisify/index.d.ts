declare module "nodefunc-promisify" {
  function promisify(
    fn: Function
  ): (...args: Array<any>) => Promise<any>
  export = promisify
}
