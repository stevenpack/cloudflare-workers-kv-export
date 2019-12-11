
class ExportRunner {
    constructor() {}

    parseConf(args) {
        try {
            console.debug("Parsing args...");
            if (process.argv.length < 3 || !args[2]) {
                console.log("Usage: node index.js <config.toml>");
                process.exit(1);
            }
            let configPath = args[2];              
            console.info(`Reading config from ${configPath}`);
            const fs = require('fs');
            let contents = fs.readFileSync(configPath);
            console.info(`Parsing...`);
            const toml = require('toml');
            let conf = toml.parse(contents);
            console.debug(JSON.stringify(conf));
            console.debug("OK");
            return conf;    
        } catch (e) {
            console.error("Failed to initialize");
            console.error(e);
            process.exit(1);
        }
    }

    validate(conf) {
        console.info("Validating...");
        if (!conf["account_id"]) {
            console.error(`accountId required`);
            return false;
        }

        if (!conf["kv-namespaces"]) {
            console.error("kv-namespaces required");
            return false;
        }

        let namespaces = conf["kv-namespaces"];
        for (let namespace of namespaces) {
            if (!namespace.id) {
                console.error('id required on all namespace elements');
                return false;
            }
        }

        if (!conf.filename) {
            const defaultFilename = "kv.db";
            console.warn(`Sqlite file not found. Defaulting to ${defaultFilename}`);
        }
        console.debug("OK");
        return conf;
    }

    async execute(args) {
        let conf = this.parseConf(args);
        if (!this.validate(conf)) {
            return false;
        }
        let namespaces = conf["kv-namespaces"];
        let destination = new SqliteDestination(conf.filename);
        await destination.init(namespaces);
        
        for (let namespaceConf of namespaces) {
            try {
                console.info(`Processing ${namespaceConf.title}/${namespaceConf.id}...`);
                let namespace = new Namespace(conf["account_id"], namespaceConf.id, namespaceConf.title);
                let keys = namespace.getKeys(namespaceId);
                console.info(`${keys.length} keys to process...`);
                for (let key of keys) {
                    try {
                        let val = namespace.getValue(key);        
                        await destination.sync(key, val);
                    } catch (e) {
                        console.warn(`Failed to write ${key}. Ignoring...`);
                        console.warn(e);
                    }                    
                }
                console.debug("OK");    
            } catch (e) {
                console.warn(`Failed to process namespace ${namespaceConf.title}/${namespaceConf.id}. Ignoring...`);
                console.warn(e);
            }
        }
        console.log("Done");
    }
}

class Namespace {
    
    constructor(accountId, namespaceId, title) {
        this.accountId = accountId;
        this.namespaceId = namespaceId;
        this.title = title;
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
        this.axios = require('axios');
    }

    async getKeys() {
        console.info('Getting keys...');
        let listKeysUrl = `${this.baseUrl}/${this.id}/keys`;
        let keysResult = await this.axios.get(listKeysUrl);
        let keys = keysResult.data;
        console.debug("OK");
        return keys;
    }

    async getValue(key) {
        console.debug(`Getting value for ${ket}...`)
        let getValueUrl = `${this.baseUrl}/storage/kv/namespaces/${this.id}/values/${key}`;
        let valueResult = await this.axios.get(getValueUrl);
        let val = valueResult.data;
        console.debug("OK");
        return val;
    }
}

class SqliteDestination {
    constructor(filename) {        
        this.filename = filename;
    }

    async init(namespaces) {
        const fs = require('fs');
        if (!fs.existsSync(this.filename)) {
            console.log(`${this.filename} does not exist. Creating...`);
            //sqlite: create
        }
        //sqlite: Connect
        //sqlite: Create tables if not exist
        for (let namespace of namespaces) {
            console.info(`Creating table ${namespace.title} if not exist (id: ${namespace.id})`);
        }
    }
    async sync(key, val) {
        //sqlite: Insert or update value
        console.debug(`Writing ${key}:${val.substring(0, Math.min(val.length, 100))}`);

    }

}

//GO
let runner = new ExportRunner();
runner.execute(process.argv)
    .then(res => console.log(res))
    .catch(e => console.error(e));

