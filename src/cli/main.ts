import yargs from "yargs";

const argv = yargs
  .scriptName("mserve")
  .env("MSERVE")
  .completion()
  .options({
    a: {
      alias: "api-key",
      demandOption: true,
      describe: "your MServe API key",
      type: "string",
    },
  })
  //.command("deploy [file]", "deploy or directory to MServe", (yargs) => {
  //  yargs.positional("file", {
  //    type: "string",
  //    describe: "file or directory to deploy",
  //  });
  //})
  .help().argv;

console.log(argv);
