"use strict";
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const Os = require("os");
const tmpDir = Os.tmpdir();
const Fs = require("fs");
const FsExtra = require("fs-extra");

const Axios = require("axios");
const Extract = require("extract-zip");
const Figlet = require("figlet");

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);
  }

  mobAPI() {
    return new Promise((resolve, reject) => {
      Figlet(
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
    // TODO prompts when confirm y then backup
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
        default: true
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
    try {
      if (this.props.confirm === true) {
        if (this.props.backup === true) {
          // Create backup directory
          const backupFolder = `/MobAPI-backup-${Date.now()}`;
          const backupDir = `${tmpDir}${backupFolder}`;
          this.log(
            chalk.yellow(
              `Creating Backup from directory ${dirname} to parent ${backupDir}`
            )
          );
          Fs.mkdirSync(backupDir);
          // Copy files to backup directory
          // TODO zip backup with prefix
          FsExtra.copySync(dirname, backupDir);

          Fs.mkdirSync(`.${backupFolder}`);
          FsExtra.copySync(backupDir, `.${backupFolder}`);
          this.log(chalk.green("Backup created..."));
        }

        // Get git master repository
        this.log(chalk.yellow("Downloading MobAPI..."));
        const {
          data: { zipball_url, tag_name }
        } = await Axios.get(
          "https://api.github.com/repos/lordrepha1980/MobAPI/releases/latest"
        );
        this.log(chalk.yellow(`MobAPI newest Version: ${tag_name}`));
        const { data } = await Axios.get(zipball_url, {
          responseType: "arraybuffer"
        });
        this.log(chalk.yellow("Downloaded MobAPI..."));

        // Write repo to temp directory
        if (data) {
          // Write zip file to tmp directory
          this.log(chalk.yellow("Writing MobAPI to temp directory..."));
          Fs.writeFileSync(`${tmpDir}/MobAPI.zip`, data);

          // Unpack zip file in tmp directory
          this.log(chalk.yellow("Unpacking MobAPI..."));
          await Extract(`${tmpDir}/MobAPI.zip`, { dir: `${tmpDir}` });

          if (this.args[0] === "init")
            // Copy files to destination
            this.log(chalk.yellow("Copying MobAPI to destination..."));
          this.fs.copy(`${tmpDir}/MobAPI-master`, this.destinationPath(`./`));

          if (this.args[0] === "update") {
            this.log(chalk.yellow("Updating MobAPI..."));
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
                `${tmpDir}/MobAPI-master/${fileName}`,
                this.destinationPath(`./${fileName}`)
              );
            }
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

  end() {
    this.log(chalk.yellow("Installing MobAPI dependencies..."));
    this.installDependencies({ bower: false, yarn: false, npm: true });

    this.log(chalk.green("MobAPI ready!"));
    this.log(
      chalk.blue(
        "Documentation: https://github.com/lordrepha1980/MobAPI#mobapi"
      )
    );
  }
};
