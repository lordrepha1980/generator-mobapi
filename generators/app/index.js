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
            this.log(chalk.red("Something went wrong..."));
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
          this.log("Error ZIP-Archivs:", err);
          reject();
        });
      });
    }

    try {
      if (this.props.confirm === true) {
        const masterDir = `MobAPI-master-${Date.now()}`;
        if (this.props.backup === true) {
          // Create backup directory
          const backupFolder = `MobAPI-backup-${Date.now()}`;
          const backupDir = `${tmpDir}/${backupFolder}`;
          this.log(
            chalk.yellow(`Creating Backup ZIP from directory ${dirname}`)
          );
          Fs.mkdirSync(backupDir);

          // Copy files to backup directory
          FsExtra.copySync(dirname, backupDir);

          // Create zipfile
          await createZip({
            zipName: `${backupFolder}.zip`,
            folderPath: backupDir,
            dirname
          });

          this.log(chalk.green("Backup ZIP created"));
        }

        // Get git master repository
        this.log(chalk.yellow("Downloading MobAPI..."));

        const {
          // eslint-disable-next-line
            data: { zipball_url, tag_name }
        } = await Axios.get(
          "https://api.github.com/repos/lordrepha1980/MobAPI/releases/latest"
        );
        // eslint-disable-next-line
        this.log(chalk.yellow(`MobAPI newest Version: ${tag_name}`));
        const { data } = await Axios.get(zipball_url, {
          responseType: "arraybuffer"
        });
        this.log(chalk.green("Download MobAPI finished"));

        // Write repo to temp directory
        if (data) {
          // Write zip file to tmp directory
          this.log(chalk.yellow("Writing MobAPI to temp directory..."));
          Fs.writeFileSync(`${tmpDir}/MobAPI.zip`, data);

          // Unpack zip file in tmp directory
          this.log(chalk.yellow("Unpacking MobAPI..."));
          await extract(`${tmpDir}/MobAPI.zip`, {
            dir: `${tmpDir}/${masterDir}`
          });

          // Reade source dir
          const sourceDirRead = Fs.readdirSync(`${tmpDir}/${masterDir}`);
          const sourceDir = sourceDirRead[0];

          if (this.args[0] === "init") {
            // Copy files to destination
            this.log(chalk.yellow("Copying MobAPI to destination..."));
            this.fs.copy(
              `${tmpDir}/${masterDir}/${sourceDir}`,
              this.destinationPath(`./`)
            );
          }

          if (this.args[0] === "update") {
            this.log(chalk.yellow("Updating MobAPI..."));

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

            this.log(chalk.green(`Update done`));

            this.log(chalk.yellow(`Merge package.json...`));
            const packageFileNew = require(`${tmpDir}/${masterDir}/${sourceDir}/package.json`);
            const packageFileOld = require(`${tmpDir}/${packageName}`);
            this.log(chalk.green(`Merge done`));

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

    this.log(chalk.yellow("Installing MobAPI dependencies..."));
    const result = this.spawnCommandSync("npm", ["install"]);
    // eslint-disable-next-line
    if (result.status !== 0) {
      this.log(chalk.red("Error installing dependencies"));
    } else {
      this.log(chalk.green("MobAPI dependencies installed"));
      this.log(chalk.green("MobAPI ready!"));
      this.log(
        chalk.green(
          "Read the Documentation: https://github.com/lordrepha1980/MobAPI#mobapi"
        )
      );
    }
  }
};
