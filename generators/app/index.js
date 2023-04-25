'use strict';
const Generator     = require('yeoman-generator');
const chalk         = require('chalk');
const yosay         = require('yosay');
const Path          = require('path');
const Process       = require('process');
const _dirname      = Process.cwd();
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

    prompting() {
        if ( this.args.length !== 1 )
            throw new Error('Please set argument init or update (yo MobAPI install/update)')

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
                console.log("Something went wrong...");
                console.dir(err);
                return;
                }
                chalk.yellow(data);
                console.log(chalk.blue(data));
        });

        if ( this.args[0] === 'init' ) {
            console.log(chalk.yellow('Initializing MobAPI...'))

            // const prompts = [
            //     {
            //         type: 'prompt',
            //         name: 'projectDir',
            //         message: 'Name of the project directory?',
            //         default: Path.dirname(_dirname)
            //     }
            // ];

            // return this.prompt(prompts).then(props => {
            //     // To access props later use this.props.someAnswer;
            //     this.props = props;
            // });
        }
    }
    
    async asyncTask() {
        try {
            //get git master repository
            console.log(chalk.yellow('Downloading MobAPI...'))
            const { data } =   await Axios.get('https://github.com/lordrepha1980/MobAPI/archive/refs/heads/master.zip', { responseType: 'arraybuffer' })
            console.log(chalk.yellow('Downloaded MobAPI...'))
            
            //write repo to temp directory
            if ( data ) {
                //write zip file to tmp directory
                console.log(chalk.yellow('Writing MobAPI to temp directory...'))
                Fs.writeFileSync(`${tmpDir}/MobAPI.zip`, data);

                //unpack zip file in tmp directory
                console.log(chalk.yellow('Unpacking MobAPI...'))
                await Extract(`${tmpDir}/MobAPI.zip`, { dir: `${tmpDir}` })

                if (this.args[0] === 'init')
                    //copy files to destination
                    console.log(chalk.yellow('Copying MobAPI to destination...'))
                    this.fs.copy(
                        `${tmpDir}/MobAPI-master`,
                        this.destinationPath(`./`)
                    );

                if (this.args[0] === 'update') {
                    console.log(chalk.yellow('Updating MobAPI...'))
                    const updateFiles = [
                        'README.md',
                        'app.js',
                        'routes',
                        'server/app',
                        'server/database/',
                    ]
                    //copy files to destination
                    for ( const fileName of updateFiles )
                        this.fs.copy(
                            `${tmpDir}/MobAPI-master/${fileName}`,
                            this.destinationPath(`./${fileName}`)
                        );
                }
                console.log(chalk.yellow('Installing MobAPI dependencies...'))
                this.installDependencies({ bower: false, yarn: false, npm: true });
                console.log(chalk.green('MobAPI ready!'))
            }
        } catch (error) {
            console.log(chalk.red('MobAPI Error!'))
            console.log(error)
            throw new Error('Error while downloading MobAPI')
        }
    }

    end() {
        console.log(chalk.green('MobAPI ready!'))
        console.log(chalk.blue('Documentation: https://github.com/lordrepha1980/MobAPI#mobapi'))
    }
};
