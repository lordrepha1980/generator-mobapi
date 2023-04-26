'use strict';
const Generator     = require('yeoman-generator');
const chalk         = require('chalk');
const Path          = require('path');
const Process       = require('process');
const Os            = require('os');
const tmpDir        = Os.tmpdir();
const Fs            = require('fs');

const Axios         = require('axios');
const Extract       = require('extract-zip');
const Figlet        = require('figlet');

module.exports = class extends Generator {
    constructor(args, opts) {
        super(args, opts)
    }

    mobAPI() {
        return new Promise((resolve, reject) => {
            Figlet("MobAPI", 
                {
                    font: "Larry 3D",
                    horizontalLayout: "default",
                    verticalLayout: "default",
                    width: 700,
                    whitespaceBreak: true,
                },
                (err, data) => {
                    if (err) {
                        this.log(chalk.red("Something went wrong..."));
                        this.dir(err);
                        reject();
                    }
                    this.log(chalk.blue(data));
                    resolve();
            });
        })
    }

    async prompting() {
        if ( this.args.length !== 1 )
            throw new Error('Please set argument init or update (yo MobAPI init/update)')

        await this.mobAPI()
        
        //update or install
        let prompts = [
            {
                type: 'confirm',
                name: 'confirm',
                message: `MobAPI will be updated in the current directory. Continue?`,
                default: false
            },
            {
                type: 'confirm',
                name: 'backup',
                message: `Create a Backup of your current MobAPI?`,
                default: true
            }
        ];

        if ( this.args[0] === 'init' ) {
            prompts = [
                {
                    type: 'confirm',
                    name: 'confirm',
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
        const dirname       = this.destinationPath(`./`);
        try {
            if ( this.props.confirm === true ) {
                if ( this.props.backup === true ) {
                    const updateFiles = Fs.readdirSync(this.destinationPath(`./`))

                    //create backup directory
                    const backupDir = `../MobAPI-backup-${Date.now()}`
                    this.log(chalk.yellow(`Creating Backup from directory ${dirname} to parent ${backupDir}`))
                    Fs.mkdirSync(backupDir);
                    //copy files to backup directory
                    for ( const fileName of updateFiles ) {
                        if ( fileName !== 'node_modules' )
                            this.fs.copy(
                                this.destinationPath(`./${fileName}`),
                                `${backupDir}/${fileName}`
                            );
                    }
                    this.log(chalk.green('Backup created...'))
                }
                //get git master repository
                this.log(chalk.yellow('Downloading MobAPI...'))
                const { data } =   await Axios.get('https://github.com/lordrepha1980/MobAPI/archive/refs/heads/master.zip', { responseType: 'arraybuffer' })
                this.log(chalk.yellow('Downloaded MobAPI...'))
                
                //write repo to temp directory
                if ( data ) {
                    //write zip file to tmp directory
                    this.log(chalk.yellow('Writing MobAPI to temp directory...'))
                    Fs.writeFileSync(`${tmpDir}/MobAPI.zip`, data);

                    //unpack zip file in tmp directory
                    this.log(chalk.yellow('Unpacking MobAPI...'))
                    await Extract(`${tmpDir}/MobAPI.zip`, { dir: `${tmpDir}` })

                    if (this.args[0] === 'init')
                        //copy files to destination
                        this.log(chalk.yellow('Copying MobAPI to destination...'))
                        this.fs.copy(
                            `${tmpDir}/MobAPI-master`,
                            this.destinationPath(`./`)
                        );

                    if (this.args[0] === 'update') {
                        this.log(chalk.yellow('Updating MobAPI...'))
                        const updateFiles = [
                            'README.md',
                            'app.js',
                            'routes',
                            'server/app',
                            'server/database/',
                        ]
                        //copy files to destination
                        for ( const fileName of updateFiles ) {
                            this.fs.copy(
                                `${tmpDir}/MobAPI-master/${fileName}`,
                                this.destinationPath(`./${fileName}`)
                            );
                        }
                    }
                    this.log(chalk.yellow('Installing MobAPI dependencies...'))
                    this.installDependencies({ bower: false, yarn: false, npm: true });
                }
            } else {
                this.log(chalk.red('User Abort!'))
            }
        } catch (error) {
            this.log(chalk.red('MobAPI Error!'))
            this.log(error)
            throw new Error('Error while downloading MobAPI')
        }
    }

    end() {
        this.log(chalk.green('MobAPI ready!'))
        this.log(chalk.blue('Documentation: https://github.com/lordrepha1980/MobAPI#mobapi'))
    }
};
