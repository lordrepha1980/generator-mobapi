"use strict";
const generator = require("yeoman-generator");
const chalk = require("chalk");
const Os = require("os");
const tmpDir = Os.tmpdir();
const Fs = require("fs");
const FsExtra = require("fs-extra");

const Axios = require("axios");
const extract = require("extract-zip");
const figlet = require("figlet");
const archiver = require("archiver");
module.exports = class extends generator {
  mobAPI() {
    return new Promise((resolve, reject) => {
      figlet(
        "MobAPI",
        {
          font: "Larry 3D",
          horizontalLayout: "default",
          verticalLayout: "default",
          width: 700,
          whitespaceBreak: true
        },
        (err, data) => {
          if (err) {
            this.log(chalk.red("Something went wrong"));
            this.dir(err);
            reject();
          }

          this.log(chalk.blue(data));
          resolve();
        }
      );
    });
  }

  async prompting() {
    if (this.args.length !== 1)
      throw new Error(
        "Please set argument init or update (yo MobAPI init/update)"
      );

    await this.mobAPI();

    // Update or install
    let prompts = [
      {
        type: "confirm",
        name: "confirm",
        message: `MobAPI will be updated in the current directory. Continue?`,
        default: false
      },
      {
        type: "confirm",
        name: "backup",
        message: `Create a Backup of your current MobAPI?`,
        default: true,
        when: answers => {
          return answers.confirm || false;
        }
      }
    ];

    if (this.args[0] === "init") {
      prompts = [
        {
          type: "confirm",
          name: "confirm",
          message: `MobAPI will be installed in the current directory. Continue?`,
          default: false
        }
      ];
    }

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
    });
  }

  async asyncTask() {
    const dirname = this.destinationPath(`./`);
    let spin = null;

    async function startSpinner({ text }) {
      const ora = await (await import("ora")).default;
      spin = ora({
        text: chalk.yellow(text),
        spinner: "aesthetic",
        color: "yellow"
      }).start();
    }

    function stopSpinner({ text }) {
      spin.succeed(chalk.green(text));
    }

    /* eslint-disable */
    function compareObjects(obj1, obj2, path = "") {
        const changes = [];

        // Compare properties of obj1 with obj2
        for (let prop in obj1) {
            const fullPath = path ? `${path}.${prop}` : prop;

            if (typeof obj1[prop] === "object" && typeof obj2[prop] === "object") {
                // Recurse if both properties are objects
                changes.push(...compareObjects(obj1[prop], obj2[prop], fullPath));
            } else if (obj1[prop] !== obj2[prop]) {
                // Otherwise compare the properties
                changes.push(
                    `${obj1[prop] ? "- " + fullPath + ": " + obj1[prop] : ""}\n${
                    obj2[prop] ? "+ " + fullPath + ": " + obj2[prop] : ""
                    }`
                );
            }
        }

      // Compare properties of obj2 with obj1
        for (let prop in obj2) {
            const fullPath = path ? `${path}.${prop}` : prop;

            if (!(prop in obj1)) {
                changes.push(
                    `${obj2[prop] ? "+ " + fullPath + ": " + obj2[prop] : ""}`
                );
            }
        }

      return changes;
    }
    /* eslint-enable */

    function createZip({ zipName, folderPath }) {
      return new Promise((resolve, reject) => {
        const output = Fs.createWriteStream(`${zipName}`);

        const archive = archiver("zip", {
          zlib: { level: 9 } // Höchste Komprimierungsstufe
        });

        archive.pipe(output);

        archive.directory(folderPath, zipName);

        archive.finalize();

        output.on("close", () => {
          resolve(true);
        });

        archive.on("error", err => {
          this.log(chalk.red("Error ZIP-Archivs:"));
          this.log(err);
          reject();
        });
      });
    }

    try {
      if (this.props.confirm === true) {
        const masterDir = `MobAPI-master-${Date.now()}`;
        if (this.props.backup === true) {
          await startSpinner({
            text: `Creating Backup ZIP from directory ${dirname}`
          });
          // Create backup directory
          const backupFolder = `MobAPI-backup-${Date.now()}`;
          const backupDir = `${tmpDir}/${backupFolder}`;

          Fs.mkdirSync(backupDir);

          // Copy files to backup directory
          FsExtra.copySync(dirname, backupDir);

          // Create zipfile
          await createZip({
            zipName: `${backupFolder}.zip`,
            folderPath: backupDir,
            dirname
          });

          stopSpinner({ text: `Backup ZIP created` });
        }

        // Get git master repository
        const {
          data: { zipball_url: zipURL, tag_name: tagName }
        } = await Axios.get(
          "https://api.github.com/repos/lordrepha1980/MobAPI/releases/latest"
        );

        await startSpinner({
          text: `Downloading MobAPI Version ${tagName} (latest)`
        });
        const { data } = await Axios.get(zipURL, {
          responseType: "arraybuffer"
        });

        stopSpinner({ text: `Download MobAPI ${tagName} (latest) finished` });

        // Write repo to temp directory
        if (data) {
          // Write zip file to tmp directory
          await startSpinner({ text: "Writing MobAPI to temp directory" });
          Fs.writeFileSync(`${tmpDir}/MobAPI.zip`, data);
          stopSpinner({ text: "Writing MobAPI to temp directory finished" });

          // Unpack zip file in tmp directory
          await startSpinner({ text: "Unpacking MobAPI" });
          await extract(`${tmpDir}/MobAPI.zip`, {
            dir: `${tmpDir}/${masterDir}`
          });
          stopSpinner({ text: "Unpacking MobAPI finished" });

          // Reade source dir
          const sourceDirRead = Fs.readdirSync(`${tmpDir}/${masterDir}`);
          const sourceDir = sourceDirRead[0];

          if (this.args[0] === "init") {
            // Copy files to destination
            await startSpinner({ text: "Copying MobAPI to destination" });
            this.fs.copy(
              `${tmpDir}/${masterDir}/${sourceDir}`,
              this.destinationPath(`./`)
            );
            stopSpinner({ text: "Copying MobAPI to destination finished" });
          }

          if (this.args[0] === "update") {
            await startSpinner({ text: "Updating MobAPI" });

            // Copy old package.json ins tmp
            const packageName = `package-${Date.now()}.json`;
            FsExtra.copySync(
              this.destinationPath(`./package.json`),
              `${tmpDir}/${packageName}`
            );

            const updateFiles = [
              "README.md",
              "app.js",
              "routes",
              "server/app",
              "server/database/"
            ];
            // Copy files to destination
            for (const fileName of updateFiles) {
              FsExtra.copySync(
                `${tmpDir}/${masterDir}/${sourceDir}/${fileName}`,
                this.destinationPath(`./${fileName}`)
              );
            }

            stopSpinner({ text: "Updating MobAPI finished" });

            await startSpinner({ text: "Merge package.json" });
            const packageFileNew = require(`${tmpDir}/${masterDir}/${sourceDir}/package.json`);
            const packageFileOld = require(`${tmpDir}/${packageName}`);
            stopSpinner({ text: "Merge package.json finished" });

            const mergedPackage = {
              ...packageFileOld,
              ...packageFileNew
            };

            mergedPackage.dependencies = {
              ...packageFileOld.dependencies,
              ...packageFileNew.dependencies
            };

            const changes = compareObjects(packageFileOld, mergedPackage);

            Fs.writeFileSync(
              this.destinationPath(`./package.json`),
              JSON.stringify(mergedPackage, false, 2)
            );

            Fs.writeFileSync(
              this.destinationPath(`./package_changes.txt`),
              changes.join("\n")
            );
          }
        }
      } else {
        this.log(chalk.red("User Abort!"));
      }
    } catch (error) {
      this.log(chalk.red("MobAPI Error!"));
      this.log(error);
      throw new Error("Error while downloading MobAPI");
    }
  }

  async end() {
    if (this.props.confirm === false) return;
    let spin = null;
    async function startSpinner({ text }) {
      const ora = await (await import("ora")).default;
      spin = ora({
        text: chalk.yellow(text),
        spinner: "aesthetic",
        color: "yellow"
      }).start();
    }

    function stopSpinner({ text }) {
      spin.succeed(chalk.green(text));
    }

    await startSpinner({ text: "Installing MobAPI dependencies" });
    const result = this.spawnCommandSync("npm", ["install"], {
      stdio: ["ignore", "ignore", "ignore"] // Hier stdout und stderr tauschen
    });
    // eslint-disable-next-line
    if (result.status !== 0) {
      spin.fail(chalk.red("Error installing dependencies"));
    } else {
      stopSpinner({ text: "Installing MobAPI dependencies finished" });
      this.log(chalk.green("MobAPI ready!"));
      this.log(
        chalk.green(
          "Read the Documentation: https://github.com/lordrepha1980/MobAPI#mobapi"
        )
      );
    }
  }
};
