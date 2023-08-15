'use strict';
var shell = require('shelljs');
const _ = require('lodash');

// Helper to filter services
const filterServices = (service, services = []) => {
  return !_.isEmpty(services) ? _.includes(services, service) : true;
};

const dbtools = {
    'tableplus': {},
    'dbeaver': {},
    'heidisql': {},
};

const buildDBeaverCmd = (service, override_local_docker_ip) => {
    let driver;
    let ip = service.external_connection.host;
    if(ip === '0.0.0.0') {
        ip = '127.0.0.1';
    }

    if(override_local_docker_ip) {
        ip = override_local_docker_ip;
    }

    if(service.type == 'mysql') {
        driver = (service.version.startsWith('8')) ? 'mysql8' : 'mysql5';
    } else {
        driver = service.type;
    }

    if(process.platform == 'darwin') {
        return `open -a "DBeaver.app" --args '-con "driver=${driver}|host=${ip}|port=${service.external_connection.port}|database=${service.creds.database}|user=${service.creds.user}|password=${service.creds.password}|create=true|save=false"' -bringToFront`;
    } else if(process.platform == 'win32') {
        return `dbeaver -con "driver=${driver}|host=${ip}|port=${service.external_connection.port}|database=${service.creds.database}|user=${service.creds.user}|password=${service.creds.password}|create=true|save=false" -bringToFront`;
    } else {
        return `dbeaver -con "driver=${driver}|host=${ip}|port=${service.external_connection.port}|database=${service.creds.database}|user=${service.creds.user}|password=${service.creds.password}|create=true|save=false" -bringToFront`;
    }
}

const buildTablePlusCmd = (service, override_local_docker_ip) => {
    let ip = service.external_connection.host;
    if(ip === '0.0.0.0') {
        ip = '127.0.0.1';
    }

    if(override_local_docker_ip) {
        ip = override_local_docker_ip;
    }

    return 'open ' + service.type + '://' + service.creds.user + ':' + service.creds.password + 
        '@' + ip + ':' + service.external_connection.port + '/' + service.creds.database;
}

const buildGuiToolCmd = (service, dbtool, override_local_docker_ip) => {
    if(dbtool == 'tableplus') {
        return buildTablePlusCmd(service, override_local_docker_ip);
    } else if(dbtool == 'dbeaver') {
        return buildDBeaverCmd(service, override_local_docker_ip);
    } else {
        throw new Error("DB GUI tool '" + dbtool + "' is not supported.");
    }
}

module.exports = lando => ({
  command: 'dbgui',
  describe: 'Connects to the database using a GUI tool of your choice',
  level: 'app',
  options: {
    tool: {
      describe: 'DB GUI tool to open',
      alias: ['t'],
      default: false,
      defaultDescription: '<read from .lando.yml>',
      string: true,
    },
    service: {
        describe: 'Service to act upon',
        alias: ['s'],
        default: null,
        defaultDescription: '<first database related service found>',
        string: true,
      },
  },
  run: async options => {

    const app = lando.getApp(options._app.root);
    await app.init();

    let dbtool = null;
    let override_local_docker_ip = null;

    if(app.config.dbgui) {
        if(app.config.dbgui.tool) {
            dbtool = app.config.dbgui.tool;
        }
        if(app.config.dbgui.docker_ip) {
            override_local_docker_ip = app.config.dbgui.docker_ip;
        }
    }

    if(!dbtool) {
        throw new Error("No DB GUI tool has been specified.");
    }

    //check/get service
    let dbservices = getDBServices(app);
    let service = '';

    if(dbservices.length < 1) {
        throw new Error("No supported database services found running.");
    }
    
    if(options.service) {
        let check = _.find(dbservices, function(n) {
            return n.service == options.service
        });
          
        if(!check) {
            throw new Error("'" + options.service + "' is not a supported database service.");
        } else {
            service = _.find(dbservices, function(n) {
                return n.service == options.service;
            });
        }
    } else {
        service = dbservices[0];
    }


    let cmd = buildGuiToolCmd(service, dbtool, override_local_docker_ip);

    console.log(cmd)
    process.exit();

    if (shell.exec(cmd).code !== 0) {
      shell.echo('Error: Opening GUI tool failed');
      shell.exit(1);
    }

  },
});


function getDBServices(app) {
    let dbtypes = [
        'mysql',
        'mariadb',
        'postgres',
        'mssql'
    ];
    let dbservices = [];
    for (const service of app.info) {
        if(service.type) {
            if(dbtypes.includes(service.type)) {
                if(isNumeric(service.external_connection.port)) {
                    dbservices.push(service);
                }
            }
        }
    }
    return dbservices;
}

function isNumeric(str) {
    return !isNaN(str) && !isNaN(parseFloat(str))
}
